#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(RNPencilKitManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(isDrawingActive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(drawingTool, NSString)
RCT_EXPORT_VIEW_PROPERTY(panelId, NSString)
RCT_EXPORT_VIEW_PROPERTY(drawingData, NSString)
RCT_EXPORT_VIEW_PROPERTY(onDrawingChange, RCTBubblingEventBlock)
@end

@interface RCT_EXTERN_MODULE(CraftoonReaderManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(pages, NSArray)
RCT_EXPORT_VIEW_PROPERTY(pageIndex, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(onPageChange, RCTBubblingEventBlock)
@end

@interface RCT_EXTERN_MODULE(CraftoonLibrary, NSObject)
RCT_EXTERN_METHOD(capturePages:(NSArray *)pages resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restorePages:(NSArray *)pages resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(printStory:(NSDictionary *)story resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(saveStory:(NSDictionary *)story resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(listStories:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(deleteStory:(NSString *)storyId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restoreStory:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadStory:(NSString *)storyId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
