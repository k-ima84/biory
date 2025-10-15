"use client";

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import type { Schema } from '@/amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import BioryLayout from '../components/BioryLayout';
import './calendar.css';

Amplify.configure(outputs);
const client = generateClient<Schema>();

// DailyRecordの型定義
type DailyRecord = {
  id: string;
  userId?: string | null;
  date?: string | null;
  mealType?: string | null;
  content?: string | null;
  condition?: string | null;
  mood?: string | null;
  weight?: number | null;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [monthlyMealData, setMonthlyMealData] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Cognitoユーザー情報を取得
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUserId(user.userId);
      } catch (error) {
        console.error('ユーザー情報取得エラー:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  // 月が変更されたら月次データを取得
  useEffect(() => {
    if (currentUserId) {
      fetchMonthlyMealData(currentDate);
    }
  }, [currentUserId, currentDate]);

  // 月次の食事データを取得（ダイジェスト用）
  const fetchMonthlyMealData = async (date: Date) => {
    if (!currentUserId) return;

    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // その月の最初と最後の日付を計算
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      console.log(`月次食事データ取得: ${startDate} ～ ${endDate}`);

      // 月全体のDailyRecordを取得（食事記録のみ）
      const { data: records } = await client.models.DailyRecord.list({
        filter: {
          and: [
            { userId: { eq: currentUserId } },
            { date: { ge: startDate } }, // 以上
            { date: { le: endDate } },   // 以下
            { breakfast: { ne: "" as any } },  // 朝食タイプが空でない
            { lunch: { ne: "" as any } },   // 昼食タイプが空でない
            { dinner: { ne: "" as any } }    // 夕食タイプが空でない
          ]
        }
      });

      // 日付のSetを作成
      const mealDates = new Set<string>();
      records?.forEach(record => {
        if (record.date) {
          mealDates.add(record.date);
        }
      });

      console.log(`食事記録がある日付: ${Array.from(mealDates)}`);
      setMonthlyMealData(mealDates);
      
    } catch (error) {
      console.error('月次食事データ取得エラー:', error);
      setMonthlyMealData(new Set());
    }
  };

  // 指定日付に食事記録があるかチェック
  const hasMealRecord = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    return monthlyMealData.has(dateString);
  };

  // 選択した日付のDailyRecordを取得
  const fetchDailyRecords = async (date: Date) => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      
      // 日付を YYYY-MM-DD 形式に変換
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      console.log(`DailyRecord検索: userId=${currentUserId}, date=${dateString}`);

      // DailyRecordを検索
      const { data: records } = await client.models.DailyRecord.list({
        filter: {
          and: [
            { userId: { eq: currentUserId } },
            { date: { eq: dateString } }
          ]
        }
      });

      console.log(`検索結果: ${records.length}件`, records);
      setDailyRecords(records || []);
      
    } catch (error) {
      console.error('DailyRecord取得エラー:', error);
      setDailyRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // 月の日数を取得
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // 月の最初の日の曜日を取得（0:日曜日、1:月曜日...）
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // 基本の祝日判定（振替休日は含まない）
  const isBaseHoliday = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 固定祝日
    const fixedHolidays = [
      { month: 1, day: 1 },    // 元日
      { month: 2, day: 11 },   // 建国記念の日
      { month: 2, day: 23 },   // 天皇誕生日
      { month: 4, day: 29 },   // 昭和の日
      { month: 5, day: 3 },    // 憲法記念日
      { month: 5, day: 4 },    // みどりの日
      { month: 5, day: 5 },    // こどもの日
      { month: 8, day: 11 },   // 山の日
      { month: 11, day: 3 },   // 文化の日
      { month: 11, day: 23 },  // 勤労感謝の日
    ];

    // 固定祝日チェック
    if (fixedHolidays.some(holiday => holiday.month === month && holiday.day === day)) {
      return true;
    }

    // ハッピーマンデー制度の祝日
    const getNthMonday = (year: number, month: number, nth: number) => {
      const firstDay = new Date(year, month - 1, 1);
      const firstMonday = 1 + (7 - firstDay.getDay() + 1) % 7;
      return firstMonday + (nth - 1) * 7;
    };

    // 成人の日（1月第2月曜日）
    if (month === 1 && day === getNthMonday(year, 1, 2)) return true;
    
    // 海の日（7月第3月曜日）
    if (month === 7 && day === getNthMonday(year, 7, 3)) return true;
    
    // 敬老の日（9月第3月曜日）
    if (month === 9 && day === getNthMonday(year, 9, 3)) return true;
    
    // スポーツの日（10月第2月曜日）
    if (month === 10 && day === getNthMonday(year, 10, 2)) return true;

    // 春分の日・秋分の日の正確な計算
    if (month === 3) {
      let shunbun;
      if (year >= 1851 && year <= 1899) {
        shunbun = Math.floor(19.8277 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
      } else if (year >= 1900 && year <= 1979) {
        shunbun = Math.floor(21.1245 + 0.242194 * (year - 1900) - Math.floor((year - 1900) / 4));
      } else if (year >= 1980 && year <= 2099) {
        shunbun = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
      } else if (year >= 2100 && year <= 2150) {
        shunbun = Math.floor(21.8510 + 0.242194 * (year - 2100) - Math.floor((year - 2100) / 4));
      }
      if (day === shunbun) return true;
    }
    
    if (month === 9) {
      let shubun;
      if (year >= 1851 && year <= 1899) {
        shubun = Math.floor(22.7020 + 0.242194 * (year - 1851) - Math.floor((year - 1851) / 4));
      } else if (year >= 1900 && year <= 1979) {
        shubun = Math.floor(23.7340 + 0.242194 * (year - 1900) - Math.floor((year - 1900) / 4));
      } else if (year >= 1980 && year <= 2099) {
        shubun = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
      } else if (year >= 2100 && year <= 2150) {
        shubun = Math.floor(24.2488 + 0.242194 * (year - 2100) - Math.floor((year - 2100) / 4));
      }
      if (day === shubun) return true;
    }

    return false;
  };

  // 振替休日判定
  const isSubstituteHoliday = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 振替休日を探すため、その月の1日から順次チェック
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      // 日曜日かつ祝日の場合
      if (d.getDay() === 0 && isBaseHoliday(d)) {
        // 振替休日を探す（翌日から開始）
        let substituteDate = new Date(d);
        substituteDate.setDate(substituteDate.getDate() + 1);
        
        // 祝日でない日まで進める
        while (isBaseHoliday(substituteDate)) {
          substituteDate.setDate(substituteDate.getDate() + 1);
        }
        
        // 振替日が引数の日付と一致する場合は振替休日
        if (substituteDate.getFullYear() === date.getFullYear() &&
            substituteDate.getMonth() === date.getMonth() &&
            substituteDate.getDate() === date.getDate()) {
          return true;
        }
      }
    }
    
    // 前月の日曜祝日の振替休日が今月に来る場合もチェック
    const prevMonth = new Date(year, month - 1, 1);
    const prevMonthLastDay = new Date(year, month, 0);
    
    for (let d = new Date(prevMonth); d <= prevMonthLastDay; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 && isBaseHoliday(d)) {
        let substituteDate = new Date(d);
        substituteDate.setDate(substituteDate.getDate() + 1);
        
        while (isBaseHoliday(substituteDate)) {
          substituteDate.setDate(substituteDate.getDate() + 1);
        }
        
        if (substituteDate.getFullYear() === date.getFullYear() &&
            substituteDate.getMonth() === date.getMonth() &&
            substituteDate.getDate() === date.getDate()) {
          return true;
        }
      }
    }
    
    return false;
  };

  // 祝日に挟まれた日の判定
  const isSandwichedHoliday = (date: Date) => {
    // 前日と翌日を取得
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // 前日と翌日が両方とも祝日（基本祝日または振替休日）で、当日が平日の場合
    return (isBaseHoliday(prevDay) || isSubstituteHoliday(prevDay)) &&
           (isBaseHoliday(nextDay) || isSubstituteHoliday(nextDay)) &&
           !isBaseHoliday(date) &&
           !isSubstituteHoliday(date);
  };

  // 日本の祝日判定（基本祝日 + 振替休日 + 挟まれた日）
  const isJapaneseHoliday = (date: Date) => {
    return isBaseHoliday(date) || isSubstituteHoliday(date) || isSandwichedHoliday(date);
  };

  // カレンダーの日付配列を生成
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    const days = [];
    
    // 前月の末尾日付を正しく取得
    const prevMonthLastDate = new Date(year, month, 0);
    const daysInPrevMonth = prevMonthLastDate.getDate();
    
    // 前月の表示日付を追加
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      const isHoliday = isJapaneseHoliday(date);
      const isSubstitute = isSubstituteHoliday(date);
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrevMonth: true,
        date: date,
        isHoliday: isHoliday,
        isSubstituteHoliday: isSubstitute
      });
    }
    
    // 当月の日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isHoliday = isJapaneseHoliday(date);
      const isSubstitute = isSubstituteHoliday(date);
      days.push({
        day: day,
        isCurrentMonth: true,
        isPrevMonth: false,
        date: date,
        isHoliday: isHoliday,
        isSubstituteHoliday: isSubstitute
      });
    }
    
    // 次月の日付を追加（最小限の週数になるまで）
    // 7の倍数になるまで次月の日付を追加
    const totalCells = days.length;
    const weeksNeeded = Math.ceil(totalCells / 7);
    const targetCells = weeksNeeded * 7;
    const remainingDays = targetCells - totalCells;
    
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const isHoliday = isJapaneseHoliday(date);
      const isSubstitute = isSubstituteHoliday(date);
      days.push({
        day: day,
        isCurrentMonth: false,
        isPrevMonth: false,
        date: date,
        isHoliday: isHoliday,
        isSubstituteHoliday: isSubstitute
      });
    }
    
    return days;
  };

  // 今日の日付かどうかをチェック
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // 選択された日付かどうかをチェック
  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getFullYear() === selectedDate.getFullYear();
  };

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
    // 月変更時は選択をクリア
    setSelectedDate(null);
    setDailyRecords([]);
  };

  // 日付をクリック
  const handleDateClick = (date: Date, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      // 当月の日付の場合、選択して記録を取得
      setSelectedDate(date);
      fetchDailyRecords(date);
    } else {
      // 他の月の日付の場合、その月に移動してから選択
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
      setSelectedDate(date);
      fetchDailyRecords(date);
    }
  };

  // 今月に戻る
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
    setDailyRecords([]);
  };

  // 食事タイプの表示名変換
  const getMealTypeName = (mealType: string | null | undefined) => {
    switch (mealType) {
      case 'breakfast': return '朝食';
      case 'lunch': return '昼食';
      case 'dinner': return '夕食';
      default: return mealType || '不明';
    }
  };

  const calendarDays = generateCalendarDays();
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <BioryLayout>
      <div className="calendar-container">
        {/* カレンダーヘッダー */}
        <div className="calendar-header">
          <h1 className="calendar-title">📅 カレンダー</h1>
          <div className="calendar-nav">
            <button 
              className="nav-button prev"
              onClick={() => changeMonth('prev')}
            >
              ‹
            </button>
            <div className="current-month">
              {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
            </div>
            <button 
              className="nav-button next"
              onClick={() => changeMonth('next')}
            >
              ›
            </button>
          </div>
          <button 
            className="today-button"
            onClick={goToCurrentMonth}
          >
            今日
          </button>
        </div>

        {/* カレンダー本体 */}
        <div className="calendar-grid-container">
          {/* 曜日ヘッダー */}
          <div className="calendar-days-header">
            {dayNames.map((dayName, index) => (
              <div 
                key={index}
                className={`day-header ${index === 0 ? 'sunday' : index === 6 ? 'saturday' : ''}`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="calendar-grid">
            {calendarDays.map((dayData, index) => (
              <div
                key={index}
                className={`calendar-day ${
                  !dayData.isCurrentMonth ? 'other-month' : ''
                } ${
                  isToday(dayData.date) ? 'today' : ''
                } ${
                  isSelectedDate(dayData.date) ? 'selected' : ''
                } ${
                  dayData.isHoliday ? 'holiday' : ''
                } ${
                  index % 7 === 0 ? 'sunday' : index % 7 === 6 ? 'saturday' : ''
                }`}
                onClick={() => handleDateClick(dayData.date, dayData.isCurrentMonth)}
              >
                <span className="day-number">{dayData.day}</span>
                
                {/* 食事記録があるかチェックしてアイコン表示 */}
                {hasMealRecord(dayData.date) && (
                  <div className="meal-indicator">
                    <div className="calendar-meal-icon" title="食事記録あり"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 選択日付情報 */}
        {selectedDate && (
          <div className="selected-date-info">
            <div className="selected-date-header">
              <h3>📅 選択した日付</h3>
              <p className="selected-date">
                {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
                （{dayNames[selectedDate.getDay()]}）
              </p>
            </div>
            
            {loading ? (
              <div className="loading">
                <p>📊 データを読み込み中...</p>
              </div>
            ) : dailyRecords.length > 0 ? (
              <div className="daily-records">
                <h4>📋 この日の記録</h4>
                {(() => {
                  // 食事タイプの優先順位を定義
                  const getMealTypePriority = (mealType: string | null | undefined) => {
                    switch (mealType) {
                      case 'breakfast': return 1; // 朝食
                      case 'lunch': return 2;     // 昼食  
                      case 'dinner': return 3;    // 夕食
                      default: return 999;        // その他
                    }
                  };

                  // 食事記録を抽出してソート
                  const mealRecords = dailyRecords
                    .filter(record => record.mealType && record.content)
                    .sort((a, b) => getMealTypePriority(a.mealType) - getMealTypePriority(b.mealType));

                  // その他の記録（体調、気分、体重）を抽出
                  const otherRecords = dailyRecords.filter(record => 
                    record.condition || record.mood || record.weight
                  );

                  return (
                    <>
                      {/* 食事記録を順序通りに表示 */}
                      {mealRecords.map((record, index) => (
                        <div key={`meal-${record.id || index}`} className="daily-record-item">
                          <div className="record-section meal">
                            <div className="record-label">🍽️ {getMealTypeName(record.mealType)}</div>
                            <div className="record-content">{record.content}</div>
                          </div>
                        </div>
                      ))}

                      {/* その他の記録を決まった順序で表示 */}
                      {otherRecords.map((record, index) => (
                        <div key={`other-${record.id || index}`} className="daily-record-item">
                          {/* 体調記録 */}
                          {record.condition && (
                            <div className="record-section condition">
                              <div className="record-label">💪 体調</div>
                              <div className="record-content">{record.condition}</div>
                            </div>
                          )}
                          
                          {/* 気分記録 */}
                          {record.mood && (
                            <div className="record-section mood">
                              <div className="record-label">😊 気分</div>
                              <div className="record-content">{record.mood}</div>
                            </div>
                          )}
                          
                          {/* 体重記録 */}
                          {record.weight && (
                            <div className="record-section weight">
                              <div className="record-label">⚖️ 体重</div>
                              <div className="record-content">{record.weight}kg</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="no-records">
                <p>📝 この日の記録がありません</p>
                <p className="no-records-hint">
                  食事記録や体調記録を追加してみましょう
                </p>
              </div>
            )}
            
            {/* デバッグ情報（開発中のみ） */}
            {process.env.NODE_ENV === 'development' && (
              <div className="debug-info">
                <details>
                  <summary>🔍 デバッグ情報</summary>
                  <div className="debug-content">
                    <p><strong>現在のユーザーID:</strong> {currentUserId || 'なし'}</p>
                    <p><strong>検索対象日付:</strong> {selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : 'なし'}</p>
                    <p><strong>取得レコード数:</strong> {dailyRecords.length}</p>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </BioryLayout>
  );
}
