// 图书组件
import React, { useEffect, useRef, useState } from 'react';
import Epub, { Book, Rendition, NavItem, Location } from 'epubjs'; // 导入 Location 类型

export default function EpubViewer({ url }: { url: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [currentLocation, setCurrentLocation] = useState('');
  const [currentCfi, setCurrentCfi] = useState('');
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentChapterHref, setCurrentChapterHref] = useState<string | null>(null); // 新增状态存储当前章节 href

  // 初始化 EPUB
  useEffect(() => {
    if (!viewerRef.current) return;

    let newBook: Book | null = null; // 声明为 let 以便在 cleanup 中访问
    let newRendition: Rendition | null = null; // 声明为 let

    newBook = Epub(url);
    newRendition = newBook.renderTo(viewerRef.current, {
      width: '100%',
      height: '600px',
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

    newRendition.display().then(() => {
      // 初始化位置
      if (newRendition) {
        updateLocation(newRendition, newBook); // 传递 rendition 和 book
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
      }
    });


    setBook(newBook);
    setRendition(newRendition);

    // 键盘翻页事件
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight') nextPage();
    };
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
      // 确保 newBook 存在再调用 destroy
      if (newBook) {
        newBook.destroy();
      }
    };
  }, [url]); // 依赖项保持不变

  // 翻页逻辑
  const nextPage = () => {
    if (!rendition) return;
    rendition.next();
  };
  const prevPage = () => {
    if (!rendition) return;
    rendition.prev();
  };

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
