import type { PDFDocumentProxy } from 'pdfjs-dist';

import React, { useCallback, useState, ChangeEvent, useEffect, useRef } from 'react'; // 引入 useEffect 和 useRef
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

import './PdfViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
};

const resizeObserverOptions = {};

const maxWidth = 800;

interface PdfViewerProps {
  url: string;
}

// 定义大纲条目类型
interface OutlineItem {
  title: string;
  bold: boolean;
  italic: boolean;
  color: Uint8ClampedArray; // [R, G, B]
  dest?: string | any[] | null; // 目标位置
  url?: string | null;
  unsafeUrl?: string | undefined;
  newWindow?: boolean | undefined;
  count?: number | undefined;
  items: OutlineItem[]; // 嵌套的大纲条目
}

export default function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [outline, setOutline] = useState<OutlineItem[] | null>(null); // PDF 大纲数据
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null); // PDF 文档对象
  const chapterSelectRef = useRef<HTMLSelectElement>(null); // 章节选择下拉框的 ref

  // 监听容器大小变化的回调
  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;
    if (entry) {
      setContainerWidth(entry.contentRect.width);
    }
  }, []);

  // 使用 ResizeObserver 监听容器大小变化
  useResizeObserver(containerRef, resizeObserverOptions, onResize);

  // PDF 文档加载成功后的回调
  async function onDocumentLoadSuccess(pdf: PDFDocumentProxy): Promise<void> {
    setPdfDocument(pdf); // 保存 PDF 文档对象
    setNumPages(pdf.numPages);
    setCurrentPage(1);
    try {
      const pdfOutline = await pdf.getOutline(); // 获取 PDF 大纲
      setOutline(pdfOutline as OutlineItem[]); // 保存大纲数据
    } catch (error) {
      console.error('获取大纲失败:', error);
      setOutline(null); // 出错时清空大纲
    }
  }

  // 跳转到上一页
  function goToPreviousPage() {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  }

  // 跳转到下一页
  function goToNextPage() {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, numPages || 1));
  }

  // 处理章节选择变化的函数
  async function handleChapterChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedDest = event.target.value;
    if (pdfDocument && selectedDest) {
      try {
        let pageRef;
        const parsedDest = JSON.parse(selectedDest); // 尝试解析 JSON 格式的目标

        if (Array.isArray(parsedDest) && parsedDest.length > 0) {
          pageRef = parsedDest[0]; // 数组的第一个元素通常是页面引用
        } else if (typeof parsedDest === 'object' && parsedDest !== null) {
          pageRef = parsedDest; // 对象本身可能就是页面引用
        } else {
          // 如果不是预期的格式，尝试使用 getDestination 获取
          console.warn('未处理的目标格式:', parsedDest);
          const destArray = await pdfDocument.getDestination(selectedDest);
          if (Array.isArray(destArray) && destArray.length > 0) {
            pageRef = destArray[0];
          }
        }

        if (pageRef) {
          const pageIndex = await pdfDocument.getPageIndex(pageRef);
          setCurrentPage(pageIndex + 1); // pageIndex 是从 0 开始的
        } else {
          console.error('无法从目标确定页面引用:', parsedDest);
        }

      } catch (error) {
        console.error('导航到目标时出错:', error);
        // 尝试回退到直接使用页码导航（如果 selectedDest 是数字字符串）
        const pageNum = parseInt(selectedDest, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages!) {
          console.log('回退到直接页码导航');
          setCurrentPage(pageNum);
        }
      }
    }
  }

  // 递归查找与当前页码最接近的章节目标
  async function findChapterDestForPage(items: OutlineItem[], targetPage: number): Promise<string | null> {
    let bestMatchDest: string | null = null;
    let minPageDiff = Infinity;

    async function searchItems(items: OutlineItem[]) {
      for (const item of items) {
        if (item.dest && pdfDocument) {
          try {
            let pageRef;
            let destValue = '';
            if (typeof item.dest === 'string') {
              destValue = item.dest;
              const destArray = await pdfDocument.getDestination(item.dest);
              if (Array.isArray(destArray) && destArray.length > 0) {
                pageRef = destArray[0];
              }
            } else {
              destValue = JSON.stringify(item.dest);
              if (Array.isArray(item.dest) && item.dest.length > 0) {
                pageRef = item.dest[0];
              } else if (typeof item.dest === 'object' && item.dest !== null) {
                pageRef = item.dest;
              }
            }

            if (pageRef) {
              const pageIndex = await pdfDocument.getPageIndex(pageRef);
              const pageNum = pageIndex + 1;
              const diff = targetPage - pageNum;

              // 找到一个小于等于当前页且差值最小的章节
              if (diff >= 0 && diff < minPageDiff) {
                minPageDiff = diff;
                bestMatchDest = destValue;
              }
            }
          } catch (e) {
            // console.warn(`处理目标 '${item.title}' 时出错:`, e);
          }
        }
        if (item.items && item.items.length > 0) {
          await searchItems(item.items);
        }
      }
    }

    await searchItems(items);
    return bestMatchDest;
  }

  // 当 currentPage 或 outline 变化时，更新章节选择下拉框的值
  useEffect(() => {
    if (pdfDocument && outline && outline.length > 0 && chapterSelectRef.current) {
      findChapterDestForPage(outline, currentPage).then(dest => {
        if (dest !== null && chapterSelectRef.current) {
          chapterSelectRef.current.value = dest;
        } else if (chapterSelectRef.current) {
          // 如果没有找到匹配的章节，重置为默认选项
          chapterSelectRef.current.value = "";
        }
      });
    }
  }, [currentPage, outline, pdfDocument]);

  // 递归渲染大纲选项的辅助函数
  function renderOutlineItems(items: OutlineItem[], level = 0): React.ReactNode[] {
    let options: React.ReactNode[] = [];
    items.forEach((item, index) => {
      // 确保 item.dest 存在，并根据类型进行处理
      const destValue = item.dest ? (typeof item.dest === 'string' ? item.dest : JSON.stringify(item.dest)) : '';
      options.push(
        <option key={`${level}-${index}-${item.title}`} value={destValue} style={{ paddingLeft: `${level * 15}px` }}>
          {'--'.repeat(level)} {item.title}
        </option>
      );
      if (item.items && item.items.length > 0) {
        // 递归调用处理子项
        options = options.concat(renderOutlineItems(item.items, level + 1));
      }
    });
    return options;
  }

  return (
    <div className="PdfViewer">
      <div className="PdfViewer__container">
        {/* 章节选择 */}
        {outline && outline.length > 0 && (
          <div className="Chapter__controls">
            <label htmlFor="chapter-select">选择章节: </label>
            {/* 绑定 ref 到 select 元素 */}
            <select id="chapter-select" ref={chapterSelectRef} onChange={handleChapterChange}>
              <option value="">-- 选择章节 --</option>
              {/* 渲染大纲选项 */}
              {renderOutlineItems(outline)}
            </select>
          </div>
        )}

        <div className="PdfViewer__container__document" ref={setContainerRef}>
          <Document file={url} onLoadSuccess={onDocumentLoadSuccess} options={options}>
            {numPages && (
              <Page
                key={`page_${currentPage}`}
                pageNumber={currentPage}
                width={containerWidth ? Math.min(containerWidth, maxWidth) : maxWidth}
              />
            )}
          </Document>
        </div>

        {/* 分页按钮 */}
        <div className="Pagination__controls">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={goToPreviousPage}
          >
            上一页
          </button>
          <span>
            第 {currentPage} 页 / 共 {numPages || '--'} 页
          </span>
          <button
            type="button"
            disabled={currentPage >= (numPages || 1)}
            onClick={goToNextPage}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}