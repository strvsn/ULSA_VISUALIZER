// testUtils.js - Test utilities for debugging and validation

import { 
  currentWindSpeedUnit, 
  windSpeedUnits, 
  convertWindSpeed, 
  updateRealtimeValuesWithUnit 
} from './windUnitManager.js';

// =====================================================
// TEST FUNCTIONS (Window Global)
// =====================================================

// 10分間平均風速機能のテスト関数
window.test10MinAvgWind = function() {
  console.log('=== 10分間平均風速機能テスト ===');
  
  import('../main.js').then(({ windHistory }) => {
    // 現在のwindHistoryデータを確認
    console.log(`現在のwindHistory記録数: ${windHistory.length}`);
    
    if (windHistory.length === 0) {
      console.log('❌ windHistoryにデータがありません');
      return;
    }
    
    // 最新のデータ10件を表示
    const latest = windHistory.slice(-10);
    console.log('最新10件のデータ:');
    latest.forEach((entry, i) => {
      console.log(`  ${i + 1}: ${entry.time.toLocaleTimeString()} - ${entry.speed} m/s`);
    });
    
    // 10分間平均の計算をテスト
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const filteredData = windHistory.filter(e => e.time >= tenMinAgo && e.time <= now && isFinite(e.speed));
    
    console.log(`\n10分間のフィルタ結果:`);
    console.log(`  対象期間: ${tenMinAgo.toLocaleTimeString()} ～ ${now.toLocaleTimeString()}`);
    console.log(`  フィルタ後のデータ数: ${filteredData.length}`);
    
    if (filteredData.length > 0) {
      const sum = filteredData.reduce((total, e) => total + Number(e.speed), 0);
      const avg = sum / filteredData.length;
      console.log(`  合計値: ${sum.toFixed(3)} m/s`);
      console.log(`  平均値: ${avg.toFixed(3)} m/s`);
      
      // 各単位での表示値を確認
      console.log('\n各単位での表示値:');
      windSpeedUnits.forEach(unit => {
        const converted = convertWindSpeed(avg, unit);
        const precision = unit === 'cm/s' ? 0 : unit === 'km/h' ? 1 : 2;
        console.log(`  ${unit}: ${converted.toFixed(precision)}`);
      });
    } else {
      console.log('  ❌ 10分間のデータが見つかりません');
    }
    
    // DOM要素の状態を確認
    const avgElement = document.getElementById('avg10minWindValue');
    const unitElement = document.getElementById('avg10minWindUnitBtn');
    
    console.log('\nDOM要素の状態:');
    console.log(`  avg10minWindValue: ${avgElement ? avgElement.textContent : '要素が見つかりません'}`);
    console.log(`  avg10minWindUnitBtn: ${unitElement ? unitElement.textContent : '要素が見つかりません'}`);
    
    console.log('=== テスト完了 ===');
  });
};

// 10分間平均風速の修正を検証するテスト関数
window.verify10MinAvgFix = function() {
  console.log('=== 10分間平均風速バグ修正検証 ===');
  
  import('../main.js').then(({ windHistory }) => {
    // テストデータを作成
    const testData = {
      speed: 15.5,
      direction: 135,
      noseWind: 12.3,
      soundSpeed: 343.2,
      soundTemp: 18.5
    };
    
    console.log('テストデータで10分間平均を模擬:', testData);
    
    // DOM要素の確認
    const valueElement = document.getElementById('avg10minWindValue');
    const unitElement = document.getElementById('avg10minWindUnitBtn');
    
    if (!valueElement) {
      console.log('❌ avg10minWindValue要素が見つかりません');
      return;
    }
    
    if (!unitElement) {
      console.log('❌ avg10minWindUnitBtn要素が見つかりません');
      return;
    }
    
    console.log('✅ DOM要素確認: 両方の要素が存在します');
    
    // 各単位でのテスト
    windSpeedUnits.forEach(unit => {
      console.log(`\n--- ${unit} 単位でのテスト ---`);
      
      // 単位を設定
      currentWindSpeedUnit = unit;
      unitElement.textContent = unit;
      
      // updateRealtimeValuesWithUnit関数をテスト
      updateRealtimeValuesWithUnit(
        testData.noseWind, 
        testData.soundSpeed, 
        testData.soundTemp, 
        testData.speed // 10分間平均として15.5 m/sを使用
      );
      
      // 結果を確認
      const displayedValue = valueElement.textContent;
      const expectedConverted = convertWindSpeed(testData.speed, unit);
      const precision = unit === 'cm/s' ? 0 : unit === 'km/h' ? 1 : 2;
      const expectedDisplay = expectedConverted.toFixed(precision);
      
      console.log(`  期待値: ${expectedDisplay}`);
      console.log(`  実際の表示: ${displayedValue}`);
      console.log(`  結果: ${displayedValue === expectedDisplay ? '✅ 正常' : '❌ 不一致'}`);
    });
    
    // 元の単位に戻す
    currentWindSpeedUnit = 'm/s';
    unitElement.textContent = 'm/s';
    
    console.log('\n=== 検証完了 ===');
    console.log('修正が正常に動作していることを確認してください。');
  });
};
