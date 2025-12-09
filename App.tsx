import React, { useState } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import SplashScreen from './src/SplashScreen';
import { PencilKitView } from './PencilKitView';

function App(): React.JSX.Element {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'editor'>('splash');

  const handleNewStory = () => {
    console.log('New Story clicked!');
    setCurrentScreen('editor');
  };

  const handleLoadStory = () => {
    console.log('Load Story clicked!');
    // TODO: Implement load story logic
  };

  if (currentScreen === 'editor') {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <PencilKitView style={styles.pencilKit} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <SplashScreen onNewStory={handleNewStory} onLoadStory={handleLoadStory} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pencilKit: {
    flex: 1,
    backgroundColor: 'white', // 캔버스 배경색
  },
});

export default App;