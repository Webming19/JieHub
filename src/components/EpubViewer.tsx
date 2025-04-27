// 图书组件
import React, { useEffect, useRef, useState } from 'react';// src/components/EpubViewer.tsx
import Epub, { Book, Rendition } from 'epubjs';
import { log } from 'console';

export default function EpubViewer({ url }: { url: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [currentLocation, setCurrentLocation] = useState('');
  const [currentCfi, setCurrentCfi] = useState('');

  // 初始化 EPUB
  useEffect(() => {
    if (!viewerRef.current) return;

    const newBook = Epub(url);
    const newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '600px',
      spread: 'none',
    });

    newRendition.display().then(() => {
      // 初始化位置
      updateLocation();
    });

    // 监听位置变化
    newRendition.on('relocated', (location: any) => {
      setCurrentCfi(location.start.cfi);
      setCurrentLocation(`${location.start.displayed.page} / ${location.start.displayed.total}`);
    });

    setBook(newBook);
    setRendition(newRendition);

    // 键盘翻页事件
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') nextPage();
    };
    window.addEventListener('keydown', handleKeyPress);

    // 更新当前位置信息
    const updateLocation = () => {
      if (newRendition && newRendition.location) {
        const location = newRendition.location.start;
        if (location) {
          setCurrentCfi(location.cfi);
          if (location.displayed) {
            setCurrentLocation(`${location.displayed.page} / ${location.displayed.total}`);
          }
        }
      }
    };

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      newBook.destroy();
    };
  }, [url]);

  // 翻页逻辑
  const nextPage = () => {
    if (!rendition) return;
    rendition.next();
  };

  const prevPage = () => {
    if (!rendition) return;
    rendition.prev();
  };

  return (
    <div>
      {/* 图书组件 */}
      <div
        ref={viewerRef}
        className="epub-viewer"
        style={{
          backgroundColor: '#f9f9f9',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
        }}
      />

      {/* 控制栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '15px 0',
        gap: '10px'
      }}>
        <button
          onClick={prevPage}
          disabled={!currentCfi}
          style={{
            padding: '6px 12px',
            backgroundColor: !currentCfi ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !currentCfi ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
        >
          上一页
        </button>

        <span style={{
          fontSize: '14px',
          color: '#666',
          flex: '1',
          textAlign: 'center'
        }}>
          {currentLocation ? `第 ${currentLocation} 页` : '加载中...'}
        </span>

        <button
          onClick={nextPage}
          disabled={!currentCfi}
          style={{
            padding: '6px 12px',
            backgroundColor: !currentCfi ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !currentCfi ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
