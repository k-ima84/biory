"use client";

import React, { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import { Amplify } from "aws-amplify";
import outputs from "../../../amplify_outputs.json";
import type { Schema } from "../../../amplify/data/resource";

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface FoodItem {
  id: string;
  foodName: string;
  energyKcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface FoodSearchProps {
  onFoodSelect?: (food: FoodItem) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function FoodSearch({ onFoodSelect, isOpen = true, onClose }: FoodSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allFoods, setAllFoods] = useState<FoodItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初期化時に全食品データを取得
  useEffect(() => {
    const loadAllFoods = async () => {
      if (isInitialized) return;
      
      try {
        setIsLoading(true);
        console.log("食品データ読み込み開始...");
        
        // 全件取得（ページネーション対応）
        let allFoodData: any[] = [];
        let nextToken = null;
        
        do {
          const result = await client.models.FoodNutrition.list({
            limit: 1000,
            nextToken: nextToken || undefined
          });
          
          if (result.data) {
            allFoodData = allFoodData.concat(result.data);
          }
          
          nextToken = result.nextToken;
        } while (nextToken);
        
        const foods = allFoodData;
        console.log(`${foods.length}件の食品データを読み込みました`);
        
        const formattedFoods: FoodItem[] = foods.map(food => ({
          id: food.id,
          foodName: food.foodName || "不明",
          energyKcal: food.energyKcal || 0,
          protein: food.proteinG || 0,
          fat: food.fatG || 0,
          carbs: food.carbohydrateG || 0,
        }));
        
        setAllFoods(formattedFoods);
        setIsInitialized(true);
        console.log("食品データ読み込み完了");
        
      } catch (error) {
        console.error("食品データ読み込みエラー:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadAllFoods();
    }
  }, [isOpen, isInitialized]);

  // あいまい検索機能
  const performSearch = (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    console.log(`検索開始: "${term}"`);
    const searchQuery = term.toLowerCase().trim();
    
    // 複数の検索パターンでフィルタリング
    const filtered = allFoods.filter(food => {
      const foodName = food.foodName.toLowerCase();
      
      // 完全一致
      if (foodName.includes(searchQuery)) {
        return true;
      }
      
      // カタカナ・ひらがな対応の検索（簡易版）
      const patterns = [
        searchQuery,
        // コッペパン -> こっぺぱん
        searchQuery.replace(/ッ/g, 'っ'),
        // パン -> ぱん  
        searchQuery.replace(/パ/g, 'ぱ').replace(/ン/g, 'ん'),
      ];
      
      return patterns.some(pattern => foodName.includes(pattern));
    });

    // 関連度でソート（完全一致を優先）
    const sorted = filtered.sort((a, b) => {
      const aName = a.foodName.toLowerCase();
      const bName = b.foodName.toLowerCase();
      
      // 完全一致を最優先
      const aExact = aName.includes(searchQuery);
      const bExact = bName.includes(searchQuery);
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // 文字列の開始位置を考慮
      const aIndex = aName.indexOf(searchQuery);
      const bIndex = bName.indexOf(searchQuery);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      return a.foodName.localeCompare(b.foodName);
    });

    console.log(`検索結果: ${sorted.length}件`);
    setSearchResults(sorted.slice(0, 20)); // 上位20件を表示
  };

  // 検索実行（デバウンス付き）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (allFoods.length > 0) {
        performSearch(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, allFoods]);

  // 食品選択ハンドラー
  const handleFoodSelect = (food: FoodItem) => {
    console.log("選択された食品:", food);
    if (onFoodSelect) {
      onFoodSelect(food);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* ヘッダー */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>食品検索</h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* 検索フィールド */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="食品名を入力（例：コッペパン）"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
            autoFocus
          />
          <p style={{ 
            fontSize: '12px', 
            color: '#666', 
            margin: '5px 0 0 0' 
          }}>
            登録済み食品数: {allFoods.length}件
          </p>
        </div>

        {/* 検索結果 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid #eee',
          borderRadius: '4px'
        }}>
          {isLoading ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#666' 
            }}>
              食品データを読み込み中...
            </div>
          ) : searchResults.length > 0 ? (
            <div>
              {searchResults.map((food) => (
                <div
                  key={food.id}
                  onClick={() => handleFoodSelect(food)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ 
                    fontWeight: 'bold', 
                    marginBottom: '4px',
                    color: '#333'
                  }}>
                    {food.foodName}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666' 
                  }}>
                    {food.energyKcal}kcal | P:{food.protein}g F:{food.fat}g C:{food.carbs}g
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.trim() ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#666' 
            }}>
              「{searchTerm}」の検索結果が見つかりませんでした
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: '#666' 
            }}>
              食品名を入力して検索してください
            </div>
          )}
        </div>

        {/* テスト用の検索例 */}
        <div style={{ 
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#f9f9f9',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>検索例:</strong> コッペパン、ごはん、りんご、牛肉
        </div>
      </div>
    </div>
  );
}