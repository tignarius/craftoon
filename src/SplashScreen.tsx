import React, { useRef } from 'react';
import { ModeInfoButton } from './components/ModeInfoButton';
import { CanvasPickerAnchor, measureCanvasPickerAnchor } from './components/CanvasOrientationPicker';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import CraftoonTitle from './assets/craftoon_title.svg';
import CraftoonSubtitle from './assets/craftoon_subtitle.svg';
import { CanvasMenuIcon, LibraryMenuIcon } from './components/StartMenuIcons';

interface SplashScreenProps {
    onNewStory: (anchor?: CanvasPickerAnchor) => void;
    onLoadStory: () => void;
}

// Tooltip updates stay local to the button.
const StartMenuAction = ({ name, onPress, children }: {
    name: string;
    onPress: (anchor?: CanvasPickerAnchor) => void;
    children: React.ReactNode;
}) => {
    const anchorView = useRef<View>(null);
    const open = () => {
        measureCanvasPickerAnchor(anchorView, onPress);
    };
    return <View ref={anchorView} collapsable={false} style={styles.menuAction}>
        <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={open}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}>
            <View pointerEvents="none" accessible={false}>{children}</View>
        </Pressable>
    </View>;
};

const SplashScreen: React.FC<SplashScreenProps> = ({ onNewStory, onLoadStory }) => {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    // 전체적인 사이즈를 20% 추가 스케일업 및 시원한 간격 계산
    const titleWidth = isLandscape ? Math.min(width * 0.55, 620) : Math.min(width * 0.9, 540);
    const titleHeight = titleWidth * (222.75 / 986.63); // SVG 원본 가로세로 비율

    const subtitleWidth = titleWidth * 0.65;
    const subtitleHeight = subtitleWidth * (200.07 / 1192.2);

    const iconSize = isLandscape ? Math.min(height * 0.4, 280) : Math.min(width * 0.54, 280);

    return (
        <LinearGradient
            // 사선 방향으로 부드럽게 이어지는 핑크-마젠타-퍼플-시안 그라데이션
            colors={['#D946EF', '#C026D3', '#9333EA', '#4F46E5', '#0EA5E9', '#06B6D4']}
            start={{ x: 0.0, y: 0.85 }}
            end={{ x: 1.0, y: 0.15 }}
            style={[styles.gradient, { width, height }]}
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.modeInfo}><ModeInfoButton mode="welcome" /></View>
                <View style={styles.container}>

                    {/* 중앙 집중형 메인 컨텐츠 래퍼 */}
                    <View style={styles.contentWrapper}>
                        {/* 1. Title: Craftoon */}
                        <View style={[styles.titleContainer, { width: titleWidth, height: titleHeight }]}>
                            <CraftoonTitle
                                width="100%"
                                height="100%"
                                preserveAspectRatio="xMidYMid meet"
                            />
                        </View>

                        {/* 2. Subtitle: Create Your Story */}
                        <View style={[styles.subtitleContainer, { width: subtitleWidth, height: subtitleHeight }]}>
                            <CraftoonSubtitle
                                width="100%"
                                height="100%"
                                preserveAspectRatio="xMidYMid meet"
                            />
                        </View>

                        {/* 3. Icon: Comic 박스 (부드러운 그림자와 둥근 모서리) */}
                        <View style={[styles.iconWrapper, { width: iconSize, height: iconSize }]}>
                            {/* Pre-rendered at 1x/2x/3x: the source SVG contains 15,695
                                paths, which are costly to mount and unmount on navigation. */}
                            <Image source={require('./assets/splash_comic.png')}
                                style={styles.comicImage} resizeMode="contain" fadeDuration={0}
                                accessible={false} />
                        </View>

                        {/* Icon-only entry points; names appear on hover or keyboard focus. */}
                        <View style={styles.menuContainer}>
                            <StartMenuAction name="Canvas" onPress={onNewStory}>
                                <CanvasMenuIcon size={isLandscape ? 84 : 96} />
                            </StartMenuAction>
                            <StartMenuAction name="Library" onPress={onLoadStory}>
                                <LibraryMenuIcon size={isLandscape ? 84 : 96} />
                            </StartMenuAction>
                        </View>
                    </View>

                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    modeInfo: { position: 'absolute', left: 20, top: 48, zIndex: 10 },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center', // 완벽한 상하 수직 중앙 정렬
        paddingHorizontal: 20,
    },
    contentWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    subtitleContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 44,
    },
    iconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.32,
        shadowRadius: 28,
        elevation: 12,
    },
    comicImage: {
        width: '100%',
        height: '100%',
    },
    menuContainer: {
        flexDirection: 'row',
        gap: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 42,
    },
    menuAction: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    iconButton: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconPressed: {
        transform: [{ scale: 0.95 }],
    },

});

export default SplashScreen;
