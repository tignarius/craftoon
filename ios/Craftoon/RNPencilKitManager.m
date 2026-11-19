#import <React/RCTViewManager.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(RNPencilKitManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(isDrawingActive, BOOL)
RCT_EXPORT_VIEW_PROPERTY(drawingTool, NSString)
RCT_EXPORT_VIEW_PROPERTY(panelId, NSString)
RCT_EXPORT_VIEW_PROPERTY(shapeFrame, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(selectionTimestamp, double)
RCT_EXPORT_VIEW_PROPERTY(renderScale, double)
RCT_EXPORT_VIEW_PROPERTY(polygonPoints, NSArray)
RCT_EXPORT_VIEW_PROPERTY(drawingData, NSString)
RCT_EXPORT_VIEW_PROPERTY(transparentBackground, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onDrawingChange, RCTBubblingEventBlock)
@end

@interface RCT_EXTERN_MODULE(CraftoonPanelClipManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(polygonPoints, NSArray)
RCT_EXPORT_VIEW_PROPERTY(clipContent, BOOL)
@end

@interface RCT_EXTERN_MODULE(CraftoonReaderManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(pages, NSArray)
RCT_EXPORT_VIEW_PROPERTY(pageIndex, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(onPageChange, RCTBubblingEventBlock)
@end

@interface RCT_EXTERN_MODULE(CraftoonLibrary, NSObject)
RCT_EXTERN_METHOD(pickTracingImage:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(retainInkReferences:(NSArray *)references resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(saveDraft:(NSDictionary *)draft resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadDraft:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setCanvasOrientation:(NSString *)orientation resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(capturePages:(NSArray *)pages resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restorePages:(NSArray *)pages resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(emailStory:(NSDictionary *)story resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(printStory:(NSDictionary *)story resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(saveStory:(NSDictionary *)story resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(listStories:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(deleteStory:(NSString *)storyId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restoreStory:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadStory:(NSString *)storyId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end

@interface RCT_EXTERN_MODULE(CraftoonPro, RCTEventEmitter)
RCT_EXTERN_METHOD(getStatus:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(purchase:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restore:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(redeem:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(showManual:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
