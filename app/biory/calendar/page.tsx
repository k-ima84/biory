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

  // カレンダーの日付配列を生成
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    
    const days = [];
    
    // 前月の末尾日付
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    
    // 前月の表示日付を追加
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        isPrevMonth: true,
        date: new Date(year, month - 1, daysInPrevMonth - i)
      });
    }
    
    // 当月の日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day: day,
        isCurrentMonth: true,
        isPrevMonth: false,
        date: new Date(year, month, day)
      });
    }
    
    // 次月の日付を追加（6週間 = 42日分になるまで）
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        day: day,
        isCurrentMonth: false,
        isPrevMonth: false,
        date: new Date(year, month + 1, day)
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
  };

  // 日付をクリック
  const handleDateClick = (date: Date, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
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
            今月
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
                  index % 7 === 0 ? 'sunday' : index % 7 === 6 ? 'saturday' : ''
                }`}
                onClick={() => handleDateClick(dayData.date, dayData.isCurrentMonth)}
              >
                <span className="day-number">{dayData.day}</span>
                {/* 将来的にここにイベントやデータを表示 */}
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
                {dailyRecords.map((record, index) => (
                  <div key={record.id || index} className="daily-record-item">
                    {/* 食事記録 */}
                    {record.mealType && record.content && (
                      <div className="record-section meal">
                        <div className="record-label">🍽️ {getMealTypeName(record.mealType)}</div>
                        <div className="record-content">{record.content}</div>
                      </div>
                    )}
                    
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
