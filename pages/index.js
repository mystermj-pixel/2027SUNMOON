import { useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

const TOTAL_PAGES = 8;
const PAGE_RATIO  = 2340 / 1655;
const pages       = Array.from({ length: TOTAL_PAGES }, (_, i) => `/pages/page-${i + 1}.jpg`);
const MIN_ZOOM    = 0.4;
const MAX_ZOOM    = 4.0;
const POPUP_W = 340;
const POPUP_H = 340;
const POP_ZOOM = 3.5;

export default function Home() {
  const bookRef     = useRef(null);
  const areaRef     = useRef(null);
  const dragRef     = useRef(null);
  const popDragRef  = useRef(null);
  const zoomRef     = useRef(1);   // zoom을 ref로도 관리 (wheel 핸들러용)
  const panRef      = useRef({ x: 0, y: 0 });

  const [pageIndex,  setPageIndex]  = useState(0);
  const [pageSize,   setPageSize]   = useState({ width: 340, height: 340 * PAGE_RATIO });
  const [zoom,       setZoom]       = useState(1);
  const [pan,        setPan]        = useState({ x: 0, y: 0 });
  const [portrait,   setPortrait]   = useState(false);
  const [ready,      setReady]      = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [magnifyOn,  setMagnifyOn]  = useState(false);
  const [popup, setPopup]           = useState({ visible: false, imgSrc: "", bgX: 0, bgY: 0, bgW: 0, bgH: 0, x: 0, y: 0 });
  const [popDragging, setPopDragging] = useState(false);

  const isCover = pageIndex === 0;
  const isBack  = pageIndex >= TOTAL_PAGES - 1;
  const showSpine = !portrait && !isCover && !isBack;
  const canPan    = zoom > 1.05 && !magnifyOn;

  /* ── 페이지별 정확한 중앙 계산 ──
     표지(0): 오른쪽 절반만 보임 → 오른쪽 페이지 중앙 정렬
     뒤표지 : 왼쪽 절반만 보임 → 왼쪽 페이지 중앙 정렬
     펼침   : 양쪽 전체 중앙 정렬                          */
  const computeCenter = useCallback((pi, z = 1) => {
    if (!areaRef.current) return { x: 0, y: 0 };
    const aw = areaRef.current.clientWidth;
    const ah = areaRef.current.clientHeight;
    const W  = pageSize.width  * z;   // 단일 페이지 폭 (줌 적용)
    const H  = pageSize.height * z;

    let x;
    if (portrait)                   x = (aw - W) / 2;
    else if (pi === 0)              x = aw / 2 - W * 1.5;  // 표지: 오른쪽 페이지 중앙
    else if (pi >= TOTAL_PAGES - 1) x = aw / 2 - W * 0.5;  // 뒤표지: 왼쪽 페이지 중앙
    else                            x = aw / 2 - W;          // 펼침: 양쪽 중앙

    return { x, y: Math.max(16, (ah - H) / 2) };
  }, [pageSize, portrait]);

  useEffect(() => {
    function calc() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const isP = vw < 800;
      setPortrait(isP);
      const maxW = isP ? Math.min(vw - 32, 390) : Math.min((vw - 80) / 2, 420);
      const maxH = vh - 180;
      let w = maxW, h = w * PAGE_RATIO;
      if (h > maxH) { h = maxH; w = h / PAGE_RATIO; }
      const ps = { width: Math.round(w), height: Math.round(h) };
      setPageSize(ps);
      // 초기 pan: 표지(첫 페이지)는 오른쪽 절반이 보이므로 따로 계산
      const aw2 = window.innerWidth;
      const ah2 = vh - 180;
      const W2  = ps.width;
      const H2  = ps.height;
      // 표지 기준으로 초기 중앙 정렬
      const initX = isP ? (aw2 - W2) / 2 : aw2 / 2 - W2 * 1.5;
      const p = { x: initX, y: Math.max(16, (ah2 - H2) / 2) };
      setPan(p);
      panRef.current = p;
      zoomRef.current = 1;
      setZoom(1);
    }
    calc();
    setReady(true);
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  /* ── 스크롤 휠 줌 (커서 기준, passive:false 필요) ── */
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const prevZ  = zoomRef.current;
      const newZ   = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZ * factor));
      const rect   = area.getBoundingClientRect();
      const cx     = e.clientX - rect.left;  // 커서 → area 좌표
      const cy     = e.clientY - rect.top;
      const ratio  = newZ / prevZ;
      const newPan = {
        x: cx - (cx - panRef.current.x) * ratio,
        y: cy - (cy - panRef.current.y) * ratio,
      };
      zoomRef.current  = newZ;
      panRef.current   = newPan;
      setZoom(newZ);
      setPan(newPan);
    };
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => area.removeEventListener("wheel", onWheel);
  }, []);

  /* ── 더블클릭 → 화면 맞추기 ── */
  const resetView = useCallback(() => {
    const p = computeCenter(pageIndex, 1);
    setPan(p);
    panRef.current = p;
    setZoom(1);
    zoomRef.current = 1;
  }, [computeCenter, pageIndex]);

  /* ── 드래그 팬 ── */
  const onMouseDown = useCallback((e) => {
    if (!canPan) return;
    e.preventDefault();
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setIsDragging(true);
  }, [canPan, pan]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const p = {
        x: dragRef.current.px + (e.clientX - dragRef.current.sx),
        y: dragRef.current.py + (e.clientY - dragRef.current.sy),
      };
      panRef.current = p;
      setPan(p);
    };
    const onUp = () => { dragRef.current = null; setIsDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging]);

  /* ── 페이지 이동 ── */
  const goPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), []);
  const goNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), []);
  const onFlip = useCallback((e) => {
    const newIdx = e.data;
    setPageIndex(newIdx);
    // 표지↔펼침↔뒤표지 전환 시 중앙 재정렬 (zoom=1일 때만)
    if (zoomRef.current <= 1.05) {
      const p = computeCenter(newIdx, 1);
      setPan(p);
      panRef.current = p;
    }
  }, [computeCenter]);

  /* ── 돋보기 ── */
  const onMagnifyClick = useCallback((e) => {
    const imgs = document.querySelectorAll(".book-page img");
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const rx  = (e.clientX - r.left) / r.width;
        const ry  = (e.clientY - r.top)  / r.height;
        const bgW = r.width  * POP_ZOOM;
        const bgH = r.height * POP_ZOOM;
        let px = e.clientX + 24;
        let py = e.clientY - POPUP_H / 2;
        if (px + POPUP_W > window.innerWidth - 10) px = e.clientX - POPUP_W - 24;
        py = Math.max(10, Math.min(window.innerHeight - POPUP_H - 60, py));
        setPopup({ visible: true, imgSrc: img.src, bgX: -(rx * bgW - POPUP_W / 2), bgY: -(ry * bgH - POPUP_H / 2), bgW, bgH, x: px, y: py });
        return;
      }
    }
  }, []);

  const onPopDragDown = useCallback((e) => {
    e.stopPropagation();
    popDragRef.current = { sx: e.clientX, sy: e.clientY, px: popup.x, py: popup.y };
    setPopDragging(true);
  }, [popup.x, popup.y]);

  useEffect(() => {
    if (!popDragging) return;
    const onMove = (e) => {
      if (!popDragRef.current) return;
      setPopup(p => ({ ...p, x: popDragRef.current.px + (e.clientX - popDragRef.current.sx), y: popDragRef.current.py + (e.clientY - popDragRef.current.sy) }));
    };
    const onUp = () => { popDragRef.current = null; setPopDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [popDragging]);

  let displayPage;
  if (portrait)     displayPage = `${pageIndex + 1} / ${TOTAL_PAGES}`;
  else if (isCover) displayPage = `표지  1 / ${TOTAL_PAGES}`;
  else if (isBack)  displayPage = `뒤표지  ${TOTAL_PAGES} / ${TOTAL_PAGES}`;
  else              displayPage = `${pageIndex + 1} – ${Math.min(pageIndex + 2, TOTAL_PAGES)} / ${TOTAL_PAGES}`;

  return (
    <div className="viewer">
      <div className="viewer__header">
        <div className="viewer__eyebrow">SUN MOON UNIVERSITY · 2027학년도 신입생 모집</div>
        <h1 className="viewer__title">조기취업형 계약학과 안내 브로셔</h1>
      </div>

      {/* 책 영역 — flex:1로 남은 공간 모두 차지 */}
      <div
        ref={areaRef}
        className="book-area"
        onDoubleClick={resetView}
        style={{ cursor: magnifyOn ? "crosshair" : isDragging ? "grabbing" : canPan ? "grab" : "default" }}
      >
        {/* 책 스테이지 — transformOrigin: 0 0 으로 커서 기준 줌 가능 */}
        <div
          className="book-stage"
          style={{
            transform:       `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition:      isDragging ? "none" : "transform 0.06s ease-out",
          }}
        >
          {ready && (
            <>
              <HTMLFlipBook
                ref={bookRef}
                width={pageSize.width}
                height={pageSize.height}
                size="fixed"
                minWidth={180} maxWidth={700}
                minHeight={260} maxHeight={1000}
                showCover={true}
                usePortrait={portrait}
                mobileScrollSupport={false}
                drawShadow={true}
                maxShadowOpacity={0.45}
                flippingTime={700}
                onFlip={onFlip}
                className="book"
              >
                {pages.map((src, i) => (
                  <div className="book-page" key={src}>
                    <img src={src} alt={`${i + 1}페이지`} draggable={false} />
                  </div>
                ))}
              </HTMLFlipBook>
              {showSpine && <div className="spine" style={{ height: pageSize.height }} />}
            </>
          )}
        </div>

        {/* 이벤트 오버레이: zoom>1 이면 pan 캡처, magnifyOn 이면 클릭 캡처.
            zoom=1 이면 pointer-events:none → react-pageflip이 직접 처리 */}
        {(canPan || magnifyOn) && (
          <div
            className="event-overlay"
            onMouseDown={canPan ? onMouseDown : undefined}
            onClick={magnifyOn ? onMagnifyClick : undefined}
            style={{ cursor: magnifyOn ? "crosshair" : isDragging ? "grabbing" : "grab" }}
          />
        )}
      </div>

      {/* 돋보기 팝업 */}
      {popup.visible && (
        <div className="mag-popup" style={{ left: popup.x, top: popup.y }} onMouseDown={onPopDragDown}>
          <div className="mag-popup__header">
            <span>🔍 확대 보기</span>
            <button className="mag-popup__close" onClick={(e) => { e.stopPropagation(); setPopup(p => ({ ...p, visible: false })); }}>✕</button>
          </div>
          <div className="mag-popup__view" style={{ backgroundImage: `url(${popup.imgSrc})`, backgroundSize: `${popup.bgW}px ${popup.bgH}px`, backgroundPosition: `${popup.bgX}px ${popup.bgY}px` }} />
          <div className="mag-popup__hint">드래그해서 팝업 이동</div>
        </div>
      )}

      {/* 컨트롤 */}
      <div className="controls">
        <button onClick={goPrev} disabled={pageIndex === 0}>‹</button>
        <span className="controls__page">{displayPage}</span>
        <button onClick={goNext} disabled={isBack}>›</button>
        <div className="divider" />
        <span className="zoom-display">{Math.round(zoom * 100)}%</span>
        <button onClick={resetView} className="zoom-reset" title="화면 맞추기 (더블클릭)">↺</button>
        <div className="divider" />
        <button onClick={() => { setMagnifyOn(v => !v); setPopup(p => ({ ...p, visible: false })); }} className={magnifyOn ? "btn-active" : ""} title="돋보기">🔍</button>
      </div>

      <p className="hint">
        {magnifyOn
          ? "🔍 보고 싶은 부분 클릭 → 확대 팝업"
          : canPan
          ? "드래그로 이동 · 스크롤로 확대/축소 · 더블클릭으로 초기화"
          : "스크롤로 확대 · 페이지를 드래그해서 넘기기 · 더블클릭으로 초기화"}
      </p>
    </div>
  );
}
