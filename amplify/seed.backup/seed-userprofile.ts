import { client, log } from './common';

// UserProfileデータの型定義（実際のスキーマに合わせる）
interface UserProfileInput {
  userId: string;
  name: string;
  height: number;
  weight: number;
  gender: string;
  favoriteFoods: string;
  allergies: string;
  dislikedFoods: string;
  exerciseFrequency: string;
  exerciseFrequencyOther: string;
}

// ユーザープロファイルのサンプル
const userProfileDataList: UserProfileInput[] = [
  {
    userId: 'user1',
    name: '田中太郎',
    gender: '男性',
    height: 175.0,
    weight: 70.0,
    favoriteFoods: '魚料理、野菜炒め、パスタ',
    allergies: '卵、乳製品',
    dislikedFoods: 'セロリ',
    exerciseFrequency: '週に1回程度運動する',
    exerciseFrequencyOther: ''
  },
  {
    userId: 'user2',
    name: '佐藤花子',
    gender: '女性',
    height: 160.0,
    weight: 55.0,
    favoriteFoods: 'サラダ、スープ、グリルチキン',
    allergies: 'そば',
    dislikedFoods: '辛い食べ物',
    exerciseFrequency: '週に1回以上運動する',
    exerciseFrequencyOther: ''
  },
  {
    userId: 'user3',
    name: '山田次郎',
    gender: '男性',
    height: 168.0,
    weight: 65.0,
    favoriteFoods: '和食、煮物、刺身',
    allergies: '',
    dislikedFoods: '洋食',
    exerciseFrequency: '運動しない',
    exerciseFrequencyOther: ''
  },
  {
    userId: 'user4',
    name: '鈴木明子',
    gender: '女性',
    height: 155.0,
    weight: 50.0,
    favoriteFoods: 'イタリアン、パスタ、ピザ',
    allergies: 'ナッツ類',
    dislikedFoods: '魚料理',
    exerciseFrequency: '運動しない',
    exerciseFrequencyOther: ''
  },
  {
    userId: 'user5',
    name: '高橋健二',
    gender: '男性',
    height: 180.0,
    weight: 85.0,
    favoriteFoods: '肉料理、ラーメン、中華料理',
    allergies: '',
    dislikedFoods: '野菜料理',
    exerciseFrequency: 'そのほか',
    exerciseFrequencyOther: 'ジムで筋トレ毎日'
  }
];

// UserProfileデータを投入する関数
export const seedUserProfileData = async () => {
  try {
    log.info('👥 UserProfileデータの投入を開始します...');

    // 既存データの重複チェック
    const existingProfiles = await client.models.UserProfile.list();
    const existingUserIds = new Set(existingProfiles.data.map((profile: any) => profile.userId));
    
    let addedCount = 0;
    let skippedCount = 0;

    for (const profileData of userProfileDataList) {
      if (existingUserIds.has(profileData.userId)) {
        log.info(`⚠️  ユーザー ${profileData.name} (${profileData.userId}) は既に存在します。スキップします。`);
        skippedCount++;
        continue;
      }

      const result = await client.models.UserProfile.create({
        userId: profileData.userId,
        name: profileData.name,
        gender: profileData.gender,
        height: profileData.height,
        weight: profileData.weight,
        favoriteFoods: profileData.favoriteFoods,
        allergies: profileData.allergies,
        dislikedFoods: profileData.dislikedFoods,
        exerciseFrequency: profileData.exerciseFrequency,
        exerciseFrequencyOther: profileData.exerciseFrequencyOther
      });

      if (result.data) {
        log.success(`✅ UserProfileデータ投入: ${profileData.name} (${profileData.userId})`);
        log.data('  詳細', {
          id: result.data.id,
          userId: result.data.userId,
          height: result.data.height,
          weight: result.data.weight
        });
        addedCount++;
      } else {
        log.error(`❌ UserProfileデータ投入失敗: ${profileData.name}`);
        if (result.errors) {
          console.error('エラー詳細:', result.errors);
        }
      }
    }

    log.info(`📊 処理結果: 追加 ${addedCount}件, スキップ ${skippedCount}件`);
    log.success('🎉 UserProfileデータの投入が完了しました！');
  } catch (error) {
    log.error(`UserProfileデータ投入エラー: ${error}`);
    throw error;
  }
};

// UserProfileデータをクリアする関数
export const clearUserProfileData = async () => {
  try {
    log.info('🧹 UserProfileデータのクリアを開始します...');

    const allProfiles = await client.models.UserProfile.list();
    
    if (allProfiles.data.length === 0) {
      log.info('📭 削除するUserProfileデータがありません。');
      return;
    }

    let deletedCount = 0;
    for (const profile of allProfiles.data) {
      await client.models.UserProfile.delete({ id: profile.id });
      log.info(`🗑️  削除: ${profile.name} (${profile.userId})`);
      deletedCount++;
    }

    log.success(`🎉 UserProfileデータクリア完了! ${deletedCount}件削除しました。`);
  } catch (error) {
    log.error(`UserProfileデータクリアエラー: ${error}`);
    throw error;
  }
};

// UserProfileデータを確認する関数
export const showUserProfileData = async () => {
  try {
    log.info('📋 UserProfileデータを確認します...');

    const allProfiles = await client.models.UserProfile.list();
    
    if (allProfiles.data.length === 0) {
      log.info('📭 UserProfileデータがありません。');
      return;
    }

    log.success(`👥 登録されているUserProfile: ${allProfiles.data.length}件`);
    console.log('\n========================================');
    
    allProfiles.data.forEach((profile: any, index: number) => {
      console.log(`\n${index + 1}. ${profile.name}`);
      console.log(`   🆔 ユーザーID: ${profile.userId}`);
      console.log(`   👤 性別: ${profile.gender}`);
      console.log(`   📏 身長: ${profile.height}cm, 体重: ${profile.weight}kg`);
      console.log(`   � 運動頻度: ${profile.exerciseFrequency}`);
      console.log(`   🚫 アレルギー: ${profile.allergies || 'なし'}`);
      console.log(`   ❤️  好きな食べ物: ${profile.favoriteFoods || 'なし'}`);
      console.log(`   💔 嫌いな食べ物: ${profile.dislikedFoods || 'なし'}`);
      if (profile.exerciseFrequencyOther) {
        console.log(`   � 運動詳細: ${profile.exerciseFrequencyOther}`);
      }
    });
    
    console.log('\n========================================');
  } catch (error) {
    log.error(`UserProfileデータ確認エラー: ${error}`);
    throw error;
  }
};

// 直接実行時の処理
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-userprofile.ts')) {
  console.log('seed-userprofile.ts: スクリプト開始');
  
  const command = process.argv[2] || 'seed';
  
  switch (command) {
    case 'seed':
      log.info('UserProfileデータシード開始...');
      seedUserProfileData()
        .then(() => {
          log.success('UserProfileデータシード完了');
          process.exit(0);
        })
        .catch((error) => {
          log.error(`UserProfileデータシード失敗: ${error}`);
          process.exit(1);
        });
      break;
      
    case 'clear':
      log.info('UserProfileデータクリア開始...');
      clearUserProfileData()
        .then(() => {
          log.success('UserProfileデータクリア完了');
          process.exit(0);
        })
        .catch((error) => {
          log.error(`UserProfileデータクリア失敗: ${error}`);
          process.exit(1);
        });
      break;
      
    case 'show':
      showUserProfileData()
        .then(() => {
          process.exit(0);
        })
        .catch((error) => {
          log.error(`UserProfileデータ確認失敗: ${error}`);
          process.exit(1);
        });
      break;
      
    default:
      console.log('使用方法:');
      console.log('  tsx seed-userprofile.ts seed    # UserProfileデータを投入');
      console.log('  tsx seed-userprofile.ts clear   # UserProfileデータをクリア');
      console.log('  tsx seed-userprofile.ts show    # UserProfileデータを確認');
      process.exit(1);
  }
}
