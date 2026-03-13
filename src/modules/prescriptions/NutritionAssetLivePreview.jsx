import { useEffect, useMemo, useRef, useState } from "react";
import NutritionPrintTemplate from "./NutritionPrintTemplate";

const PREVIEW_PAGE_WIDTH = 860;
const PREVIEW_PAGE_HEIGHT = 1220;

export default function NutritionAssetLivePreview(props) {
  const frameRef = useRef(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!frameRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      setFrameSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  const previewScale = useMemo(() => {
    if (!frameSize.width || !frameSize.height) return 1;

    const widthScale = frameSize.width / PREVIEW_PAGE_WIDTH;
    const heightScale = frameSize.height / PREVIEW_PAGE_HEIGHT;
    return Math.min(widthScale, heightScale, 1);
  }, [frameSize.height, frameSize.width]);

  return (
    <div ref={frameRef} className="flex h-full min-h-[640px] w-full items-center justify-center overflow-hidden">
      <div
        className="origin-center transition-transform duration-200"
        style={{
          width: PREVIEW_PAGE_WIDTH,
          height: PREVIEW_PAGE_HEIGHT,
          transform: `scale(${previewScale})`,
        }}
      >
        <NutritionPrintTemplate {...props} rootId="nutrition-preview-area" />
      </div>
    </div>
  );
}
