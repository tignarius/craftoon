import React from 'react';
import {
  SafeAreaView,
  Text,
  View,
  StyleSheet,
} from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Welcome to Craftoon!</Text>
        <Text style={styles.subtitle}>윈도우에서 수정하고 맥에서 봅니다</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // 하얀색 배경
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center', // 세로 중앙 정렬
    alignItems: 'center',     // 가로 중앙 정렬
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#007AFF', // 파란색 글씨
  },
});

export default App;