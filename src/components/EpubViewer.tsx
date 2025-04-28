// 图书组件
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Epub, { Book, Rendition, NavItem, Location } from 'epubjs'; // 导入 Location 类型

export default function EpubViewer({ url }: { url: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const renditionRef = useRef<Rendition | null>(null); // 使用 ref 存储 rendition
  const [currentLocation, setCurrentLocation] = useState('');
  const [currentCfi, setCurrentCfi] = useState('');
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentChapterHref, setCurrentChapterHref] = useState<string | null>(null);

  // 用于触摸滑动状态
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const swipeThreshold = 50; // 定义最小滑动距离阈值
  const iframeDocRef = useRef<Document | null>(null); // Ref 存储 iframe document

  // 初始化 EPUB
  useEffect(() => {
    if (!viewerRef.current) return;

    let newBook: Book | null = null;
    let newRendition: Rendition | null = null;
    // 使用 Ref 来存储 iframe document 的引用，移除局部变量声明

    newBook = Epub(url);
    newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '580px',
      spread: 'none',
    });

    // 获取目录信息
    newBook.ready.then(() => {
      if (newBook?.navigation?.toc) {
        setToc(newBook.navigation.toc);
      }
      // 初始化时也尝试更新章节 Href
      if (newRendition?.location) {
        updateLocation(newRendition, newBook);
      }
    });

    // 显示图书
    newRendition.display().then(() => {
      // 初始化位置
      if (newRendition) {
        updateLocation(newRendition, newBook); // 传递 rendition 和 book

        // 获取 iframe 并添加初始事件监听器
        const iframe = viewerRef.current?.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          iframeDocRef.current = iframe.contentDocument;
          iframeDocRef.current.addEventListener('touchstart', handleTouchStart);
          iframeDocRef.current.addEventListener('touchmove', handleTouchMove);
          iframeDocRef.current.addEventListener('touchend', handleTouchEnd);
        }
      }
    });

    // 监听位置变化
    newRendition.on('relocated', (location: Location) => { // 使用导入的 Location 类型
      // 确保 location 和 location.start 存在
      if (location?.start) {
        setCurrentCfi(location.start.cfi);

        // 更新章节内页码
        if (location.start.displayed) {
          setCurrentLocation(`${location.start.displayed.page} / ${location.start.displayed.total}`);
        } else {
          setCurrentLocation('加载中...');
        }

        // 更新当前章节的 Href
        if (newBook?.spine) {
          try {
            const currentSpineItem = newBook.spine.get(location.start.cfi);
            if (currentSpineItem?.href) {
              setCurrentChapterHref(currentSpineItem.href); // 更新当前章节 href 状态
            }
          } catch (error) {
            console.error("Error getting spine item for chapter update:", error);
          }
        }

        // --- 重新绑定触摸事件 ---
        // 延迟执行以确保 iframe 渲染完成
        setTimeout(() => {
          const currentIframe = viewerRef.current?.querySelector('iframe');
          if (currentIframe && currentIframe.contentDocument) {
            // 移除旧监听器 (如果存在)
            if (iframeDocRef.current) {
              iframeDocRef.current.removeEventListener('touchstart', handleTouchStart);
              iframeDocRef.current.removeEventListener('touchmove', handleTouchMove);
              iframeDocRef.current.removeEventListener('touchend', handleTouchEnd);
            }
            // 更新 ref 并添加新监听器
            iframeDocRef.current = currentIframe.contentDocument;
            iframeDocRef.current.addEventListener('touchstart', handleTouchStart);
            iframeDocRef.current.addEventListener('touchmove', handleTouchMove);
            iframeDocRef.current.addEventListener('touchend', handleTouchEnd);
          } else {
            console.warn("Could not find iframe document after relocation.");
          }
        }, 100); // 短暂延迟确保 DOM 更新
        // --- 重新绑定触摸事件结束 ---
      }
    });

    setBook(newBook);
    setRendition(newRendition);
    renditionRef.current = newRendition; // 将 rendition 实例存入 ref

    // 使用 memoized 的键盘事件处理函数
    window.addEventListener('keydown', handleKeyPress);

    // 更新当前位置信息 - 接收 rendition 和 book 作为参数
    const updateLocation = (rend: Rendition | null, bk: Book | null) => {
      // 确保 rend, rend.location, rend.location.start 存在
      if (rend?.location?.start) {
        const locationStart = rend.location.start;
        setCurrentCfi(locationStart.cfi);

        // 更新章节内页码
        if (locationStart.displayed) {
          setCurrentLocation(`${locationStart.displayed.page} / ${locationStart.displayed.total}`);
        } else {
          setCurrentLocation('加载中...');
        }

        // 更新当前章节的 Href
        if (bk?.spine) {
          try {
            const currentSpineItem = bk.spine.get(locationStart.cfi);
            if (currentSpineItem?.href) {
              setCurrentChapterHref(currentSpineItem.href); // 更新当前章节 href 状态
            }
          } catch (error) {
            console.error("Error getting spine item for initial chapter update:", error);
          }
        }
      }
    };

    // 清理函数
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      // 移除 iframe 上的事件监听器 (使用 ref)
      if (iframeDocRef.current) {
        iframeDocRef.current.removeEventListener('touchstart', handleTouchStart);
        iframeDocRef.current.removeEventListener('touchmove', handleTouchMove);
        iframeDocRef.current.removeEventListener('touchend', handleTouchEnd);
      }
      // 确保 newBook 存在再调用 destroy
      if (newBook) {
        newBook.destroy();
      }
    };
  }, [url]); // 依赖项保持不变

  // 使用 useCallback 包装事件处理函数
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      renditionRef.current?.prev();
    }
    if (e.key === 'ArrowRight') {
      renditionRef.current?.next();
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diffX = touchStartX.current - touchEndX.current;
    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        // 向左滑动 -> 下一页
        renditionRef.current?.next();
      }
      else {
        // 向右滑动 -> 上一页
        renditionRef.current?.prev();
      }
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  }, []);

  // 处理章节切换的函数
  const handleChapterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const href = event.target.value;
    if (rendition && href) {
      rendition.display(href);
      setCurrentChapterHref(href); // 手动切换时也更新状态
    }
  };

  // 递归渲染章节选项的辅助函数 (处理嵌套章节)
  const renderTocOptions = (items: NavItem[], level = 0): React.ReactNode[] => {
    let options: React.ReactNode[] = [];
    items.forEach(item => {
      options.push(
        <option key={item.id || item.href} value={item.href} style={{ paddingLeft: `${level * 15}px` }}>
          {'--'.repeat(level)} {item.label.trim()}
        </option>
      );
      if (item.subitems && item.subitems.length > 0) {
        options = options.concat(renderTocOptions(item.subitems, level + 1));
      }
    });
    return options;
  };

  return (
    <div>
      {/* 章节选择下拉框 */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="chapter-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>章节:</label>
        <select
          id="chapter-select"
          onChange={handleChapterChange}
          value={currentChapterHref || ''} // 绑定 value 到状态
          style={{ padding: '5px', minWidth: '200px', maxWidth: '100%' }}
        >
          <option value="">选择章节...</option>
          {renderTocOptions(toc)}
        </select>
      </div>

      {/* 图书组件 - 移除外部 div 的触摸事件监听器 */}
      <div
        ref={viewerRef}
        className="epub-viewer"
        style={{
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          touchAction: 'pan-y', // 保持 pan-y 以允许垂直滚动
          backgroundColor: '#f9f9f9',
          overflow: 'hidden', // 防止 viewerRef 本身滚动
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
          onClick={() => renditionRef.current?.prev()}
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
          onClick={() => renditionRef.current?.next()}
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
