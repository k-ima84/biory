"use client";

import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';
import type { Schema } from '@/amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';
import BioryLayout from '../components/BioryLayout';
import './calendar.css';

Amplify.configure(outputs);
const client = generateClient<Schema>();

// Cognitoユーザー情報を取得するユーティリティ関数
const fetchCognitoUserInfo = async () => {
  try {
    const user = await getCurrentUser();
    return {
      userId: user.userId,
      email: user.signInDetails?.loginId || 'unknown',
    };
  } catch (error) {
    console.error('Cognitoユーザー情報取得エラー:', error);
    throw error;
  }
};

// DailyRecordの型定義
type DailyRecord = {
  id: string;
  userId?: string | null;
  date?: string | null;
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
  // 🆕 分割栄養情報
  calories_bre?: number | null;
  calories_lun?: number | null;
  calories_din?: number | null;
  protein_bre?: number | null;
  protein_lun?: number | null;
  protein_din?: number | null;
  fat_bre?: number | null;
  fat_lun?: number | null;
  fat_din?: number | null;
  carbs_bre?: number | null;
  carbs_lun?: number | null;
  carbs_din?: number | null;
  condition?: string | null;
  mood?: string | null;
  weight?: number | null;
};

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [monthlyMealData, setMonthlyMealData] = useState<Set<string>>(new Set());
  const [monthlyHealthData, setMonthlyHealthData] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [registrationCount, setRegistrationCount] = useState(0);

  // Cognitoユーザー認証とデータ取得
  const fetchCognitoUserData = async () => {
    try {
      const userInfo = await fetchCognitoUserInfo();
      setCurrentUserId(userInfo.userId);
      
      console.log('Calendar - Cognito User Info:', {
        userId: userInfo.userId,
        email: userInfo.email
      });
    } catch (error) {
      console.error('認証エラー:', error);
      router.push("/biory/login");
      return;
    }
  };

  // 認証チェック
  useEffect(() => {
    fetchCognitoUserData();
  }, []);

  // 月が変更されたら月次データを取得
  useEffect(() => {
    if (currentUserId) {
      fetchMonthlyMealData(currentDate);
      fetchMonthlyHealthData(currentDate);
    }
  }, [currentUserId, currentDate]);

  // 登録日数を更新
  useEffect(() => {
    const count = calculateRegistrationCount();
    setRegistrationCount(count);
  }, [monthlyMealData, monthlyHealthData]);

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

      // 月全体のDailyRecordを取得
      const { data: records } = await client.models.DailyRecord.list({
        filter: {
          and: [
            { userId: { eq: currentUserId } },
            { date: { ge: startDate } }, 
            { date: { le: endDate } }
          ]
        }
      });

      // 🆕 デバッグログ追加
      console.log('取得したレコード:', records);

      // JavaScript側で食事記録の存在をチェック（「ー」は除外）
      const mealDates = new Set<string>();
      records?.forEach(record => {
        console.log('食事記録チェック:', {
          date: record.date,
          breakfast: record.breakfast,
          lunch: record.lunch,
          dinner: record.dinner
        });

        if (record.date) {
          // 🆕 食事が無効かどうかを判定する関数
          const isEmptyMeal = (meal: string | null | undefined) => {
            // そもそも食事のカラムがない（null/undefined）
            if (!meal) return true;
            
            // 空文字列の場合
            if (meal.trim() === "") return true;
            
            // 「ー」または「-」で登録されている場合
            if (meal.trim() === "—" || meal.trim() === "ー" || meal.trim() === "-") return true;
            
            return false;
          };

          // 各食事が有効かどうかをチェック
          const breakfastValid = !isEmptyMeal(record.breakfast);
          const lunchValid = !isEmptyMeal(record.lunch);
          const dinnerValid = !isEmptyMeal(record.dinner);
          
          // 1食でも有効な食事があれば「食事あり」
          const hasMeal = breakfastValid || lunchValid || dinnerValid;
          
          console.log(`${record.date}の食事判定:`, {
            breakfastValid,
            lunchValid, 
            dinnerValid,
            hasMeal
          });
          
          if (hasMeal) {
            mealDates.add(record.date);
          }
        }
      });

      console.log(`食事記録がある日付: ${Array.from(mealDates)}`);
      setMonthlyMealData(mealDates);
      
    } catch (error) {
      console.error('月次食事データ取得エラー:', error);
      setMonthlyMealData(new Set());
    }
  };

  // 月次の健康記録データを取得（ダイジェスト用）
  const fetchMonthlyHealthData = async (date: Date) => {
    if (!currentUserId) return;

    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      
      // その月の最初と最後の日付を計算
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      console.log(`月次健康データ取得: ${startDate} ～ ${endDate}`);

      // 月全体のDailyRecordを取得（健康記録がある日）
      const { data: records } = await client.models.DailyRecord.list({
        filter: {
            and: [
             { userId: { eq: currentUserId } },
             { date: { ge: startDate } }, // 以上
             { date: { le: endDate } }    // 以下
           ]
        }
      });

      // 健康記録がある日付をSetで管理
      const healthDates = new Set<string>();
      records.forEach(record => {
        if (record.date && (record.weight || record.mood || record.condition)) {
          healthDates.add(record.date);
        }
      });

      console.log(`健康記録がある日数: ${healthDates.size}`);
      setMonthlyHealthData(healthDates);
      
    } catch (error) {
      console.error('月次健康データ取得エラー:', error);
      setMonthlyHealthData(new Set());
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

  // 指定日付に健康記録があるかチェック
  const hasHealthRecord = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    
    return monthlyHealthData.has(dateString);
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

      // 開発環境でのデバッグ情報をまとめて出力
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 デバッグ情報:', {
          現在のユーザーID: currentUserId || 'なし',
          検索対象日付: dateString,
          取得レコード数: records.length,
          レコード詳細: records
        });
      }
      
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

  const calendarDays = generateCalendarDays();
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  // 登録日数を計算する関数
  const calculateRegistrationCount = () => {
    const registeredDates = new Set([...monthlyMealData, ...monthlyHealthData]);
    return registeredDates.size;
  };

  // 登録日数に基づくメッセージを生成する関数
  const getMotivationMessage = (count: number) => {
    if (count === 0) {
      return {
        message: "アプリを使って健康管理を始めてみましょう！",
        emoji: "🌱",
        color: "#FF6B6B",
        title: "始めてみよう！"
      };
    } else if (count <= 3) {
      return {
        message: "記録開始おめでとう！この調子で続けていきましょう！",
        emoji: "🌟",
        color: "#4ECDC4",
        title: "いいスタート！"
      };
    } else if (count <= 10) {
      return {
        message: `${count}日間登録できてますね！健康意識が高まってきています！`,
        emoji: "💪",
        color: "#45B7D1",
        title: "継続中！"
      };
    } else if (count <= 20) {
      return {
        message: `${count}日間登録できてますね！健康的な習慣が身についてます！`,
        emoji: "🏆",
        color: "#96CEB4",
        title: "素晴らしい！"
      };
    } else if (count <= 29) {
      return {
        message: `${count}日間も登録できてますね！健康管理のプロですね！`,
        emoji: "👑",
        color: "#FECA57",
        title: "健康マスター！"
      };
    } else {
      return {
        message: "長期間の継続、本当に素晴らしいです！",
        emoji: "🌈",
        color: "#FF9FF3",
        title: "健康のカリスマ！"
      };
    }
  };

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

        {/* モチベーションメッセージ */}
        {(() => {
          const motivationData = getMotivationMessage(registrationCount);
          return (
            <div className="motivation-card" style={{ borderLeftColor: motivationData.color }}>
              <div className="motivation-header">
                <span className="motivation-emoji">{motivationData.emoji}</span>
                <h3 className="motivation-title" style={{ color: motivationData.color }}>
                  {motivationData.title}
                </h3>
                <span className="registration-count">
                  {registrationCount}日記録中
                </span>
              </div>
              <p className="motivation-message">{motivationData.message}</p>
            </div>
          );
        })()}

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
                
                {/* 記録があるかチェックしてアイコン表示 */}
                {(hasMealRecord(dayData.date) || hasHealthRecord(dayData.date)) && (
                  <div className="meal-indicator">
                    {hasMealRecord(dayData.date) && (
                      <div className="calendar-meal-icon" title="食事記録あり"></div>
                    )}
                    {hasHealthRecord(dayData.date) && (
                      <div className="calendar-record-icon" title="健康記録あり"></div>
                    )}
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
        ) : (() => {
            // レコードの存在と有効性をチェック
            if (dailyRecords.length === 0) {
              return (
                <div className="no-records">
                  <p>📝 この日の記録がありません</p>
                  <p className="no-records-hint">
                    食事記録や体調記録を追加してみましょう
                  </p>
                </div>
              );
            }

            // 最初のレコードを取得（通常は1日1レコード）
            const record = dailyRecords[0];
            
            if (!record) {
              return (
                <div className="no-records">
                  <p>📝 この日の記録がありません</p>
                  <p className="no-records-hint">
                    食事記録や体調記録を追加してみましょう
                  </p>
                </div>
              );
            }

            // 🆕 共通の食事判定関数
            const isEmptyMeal = (meal: string | null | undefined) => {
              if (!meal) return true;
              if (meal.trim() === "") return true;
              if (meal.trim() === "—" || meal.trim() === "ー" || meal.trim() === "-") return true;
              return false;
            };

            // 🆕 有効な食事記録があるかチェック
            const hasValidMeals = !isEmptyMeal(record.breakfast) || 
                                 !isEmptyMeal(record.lunch) || 
                                 !isEmptyMeal(record.dinner);

            // 健康記録（気分・体調・体重）があるかチェック
            const hasHealthRecords = (record.condition && record.condition.trim() !== "") || 
                                    (record.mood && record.mood.trim() !== "") || 
                                    record.weight;

            // 有効な記録が何もない場合は「記録がありません」を表示
            if (!hasValidMeals && !hasHealthRecords) {
              return (
                <div className="no-records">
                  <p>📝 この日の記録がありません</p>
                  <p className="no-records-hint">
                    食事記録や体調記録を追加してみましょう
                  </p>
                </div>
              );
            }

            // 有効な記録がある場合は記録を表示
            return (
              <div className="daily-records">
                <h4>📋 この日の記録</h4>
                {(() => {
                  // 食事データを配列形式で整理（無効な食事記録を除外）
                  const mealData = [
                    { type: 'breakfast', label: '朝食', content: record.breakfast },
                    { type: 'lunch', label: '昼食', content: record.lunch },
                    { type: 'dinner', label: '夕食', content: record.dinner }
                  ].filter(meal => !isEmptyMeal(meal.content));

                  const hasOtherRecords = record.condition || record.mood || record.weight;
              
              // 🆕 栄養情報の表示条件を食事記録の存在と連動
              const hasNutritionData = hasValidMeals && (
                record.calories_bre !== null || record.calories_lun !== null || record.calories_din !== null ||
                record.protein_bre !== null || record.protein_lun !== null || record.protein_din !== null ||
                record.fat_bre !== null || record.fat_lun !== null || record.fat_din !== null ||
                record.carbs_bre !== null || record.carbs_lun !== null || record.carbs_din !== null
              );

              // 栄養価の合算計算
              const totalCalories = (record.calories_bre || 0) + (record.calories_lun || 0) + (record.calories_din || 0);
              const totalProtein = (record.protein_bre || 0) + (record.protein_lun || 0) + (record.protein_din || 0);
              const totalFat = (record.fat_bre || 0) + (record.fat_lun || 0) + (record.fat_din || 0);
              const totalCarbs = (record.carbs_bre || 0) + (record.carbs_lun || 0) + (record.carbs_din || 0);

              return (
                <>
                  {/* 栄養情報を最初に表示 */}
                  {hasNutritionData && (
                    <div className="daily-record-item nutrition-summary">
                      <div className="record-section nutrition">
                        <div className="record-label">📊 栄養情報（1日合計）</div>
                        <div className="nutrition-content">
                          <div className="nutrition-grid">
                            {totalCalories > 0 && (
                              <div className="nutrition-item">
                                <span className="nutrition-label">カロリー</span>
                                <span className="nutrition-value">{Math.round(totalCalories)}kcal</span>
                              </div>
                            )}
                            {totalProtein > 0 && (
                              <div className="nutrition-item">
                                <span className="nutrition-label">タンパク質</span>
                                <span className="nutrition-value">{Math.round(totalProtein)}g</span>
                              </div>
                            )}
                            {totalFat > 0 && (
                              <div className="nutrition-item">
                                <span className="nutrition-label">脂質</span>
                                <span className="nutrition-value">{Math.round(totalFat)}g</span>
                              </div>
                            )}
                            {totalCarbs > 0 && (
                              <div className="nutrition-item">
                                <span className="nutrition-label">炭水化物</span>
                                <span className="nutrition-value">{Math.round(totalCarbs)}g</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 食事記録を縦並びで表示 */}
                  {mealData.length > 0 && (
                    <div className="daily-record-item">
                      {mealData.map((meal, index) => (
                        <div key={`meal-${meal.type}-${index}`} className="record-section meal">
                          <div className="record-label">🍽️ {meal.label}</div>
                          <div className="record-content">{meal.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* その他の記録 */}
                  {hasOtherRecords && (
                    <div className="daily-record-item">
                      {/* 体調記録 */}
                      {record.condition && record.condition.trim() !== "" && (
                        <div className="record-section condition">
                          <div className="record-label">💪 体調</div>
                          <div className="record-content">{record.condition}</div>
                        </div>
                      )}
                      
                      {/* 気分記録 */}
                      {record.mood && record.mood.trim() !== "" && (
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
                  )}
                  </>
                );
              })()}
              </div>
            );
          })()}
          </div>
        )}
      </div>
    </BioryLayout>
  );
}
