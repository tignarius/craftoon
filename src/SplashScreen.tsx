import React from 'react';
import {
    View,
    Text,
    Image,
    ImageBackground,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
    onNewStory: () => void;
    onLoadStory: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onNewStory, onLoadStory }) => {
    return (
        <ImageBackground
            source={require('./assets/bg.jpeg')}
            style={styles.backgroundImage}
            resizeMode="cover"
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>

                    {/* 1. Title: Craftoon */}
                    <View style={styles.titleContainer}>
                        <Image
                            source={require('./assets/craftoon_title.png')}
                            style={styles.titleImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* 2. Subtitle: Create Your Story */}
                    <View style={styles.subtitleContainer}>
                        <Image
                            source={require('./assets/craftoon_subtitle.png')}
                            style={styles.subtitleImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* 3. Icon: Comic */}
                    <View style={styles.iconContainer}>
                        <Image
                            source={require('./assets/splash_icon_final.png')}
                            style={styles.iconImage}
                            resizeMode="contain"
                        />
                    </View>

                    {/* 4. Action Buttons */}
                    <View style={styles.buttonContainer}>
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
        width: width,
        height: height,
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
        marginBottom: 20,
        width: '80%',
        alignItems: 'center',
    },
    titleImage: {
        width: '100%',
        height: 100, // Adjust based on aspect ratio
    },
    subtitleContainer: {
        marginBottom: 20,
        width: '60%',
        alignItems: 'center',
    },
    subtitleImage: {
        width: '100%',
        height: 60, // Adjust based on aspect ratio
    },
    iconContainer: {
        marginBottom: 40,
        width: 280,
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconImage: {
        width: '100%',
        height: '100%',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 20, // Note: gap might require newer RN versions or polyfill in layout, using margin is safer if unsure, but RN 0.72+ supports gap.
        justifyContent: 'center',
        width: '100%',
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
        // Shadow for iOS
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.37,
        shadowRadius: 32,
        // Elevation for Android
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
        // fontFamily: 'Gamja Flower', // Font needs to be linked if used
    },
});

export default SplashScreen;
