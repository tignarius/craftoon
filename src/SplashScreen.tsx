import React from 'react';
import {
    View,
    Text,
    ImageBackground,
    StyleSheet,
    TouchableOpacity,
    useWindowDimensions, // Changed from Dimensions
    SafeAreaView,
} from 'react-native';
import CraftoonTitle from './assets/craftoon_title.svg';
import CraftoonSubtitle from './assets/craftoon_subtitle.svg';
import SplashComic from './assets/splash_comic3.svg';

interface SplashScreenProps {
    onNewStory: () => void;
    onLoadStory: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onNewStory, onLoadStory }) => {
    const { width, height } = useWindowDimensions(); // Use hook for responsiveness
    const isLandscape = width > height;

    return (
        <ImageBackground
            source={require('./assets/bg.png')}
            style={[styles.backgroundImage, { width, height }]}
            resizeMode="cover"
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>

                    {/* 1. Title: Craftoon */}
                    <View style={[styles.titleContainer, { flex: isLandscape ? 2 : 1.5 }]}>
                        <CraftoonTitle
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid meet"
                        />
                    </View>

                    {/* 2. Subtitle: Create Your Story */}
                    <View style={[styles.subtitleContainer, { flex: 0.5 }]}>
                        <CraftoonSubtitle
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid meet"
                        />
                    </View>

                    {/* 3. Icon: Comic */}
                    <View style={[styles.iconContainer, { flex: isLandscape ? 3 : 2 }]}>
                        <SplashComic
                            width="100%"
                            height="100%"
                            preserveAspectRatio="xMidYMid meet"
                        />
                    </View>

                    {/* 4. Action Buttons */}
                    <View style={[styles.buttonContainer, { flex: 1 }]}>
                        <TouchableOpacity onPress={onNewStory} style={styles.buttonNewStory}>
                            <Text style={styles.buttonText}>New Story</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onLoadStory} style={styles.buttonLoadStory}>
                            <Text style={styles.buttonText}>Load Story</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </SafeAreaView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    titleContainer: {
        width: '90%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitleContainer: {
        width: '70%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: '80%', // Increased width usage
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 20,
        justifyContent: 'center',
        width: '100%',
        alignItems: 'center',
    },
    buttonNewStory: {
        width: 200,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.37,
        shadowRadius: 32,
        elevation: 5,
    },
    buttonLoadStory: {
        width: 200,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 32,
        elevation: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
});

export default SplashScreen;
