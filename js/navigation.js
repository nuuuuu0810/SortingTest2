// js/navigation.js
document.addEventListener('DOMContentLoaded', () => {
    const tocLinks = document.querySelectorAll('.table-of-contents a');
    const contentArea = document.querySelector('.content-area');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');

    let allPageIds = [];
    let currentPageIndex = -1;

    function initializeApp() {
        allPageIds = Array.from(tocLinks).map(link => link.getAttribute('href').substring(1));
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial page load based on hash
    }

    async function loadContentPage(pageId) {
        if (!pageId) {
            contentArea.innerHTML = '<section class="content-page active"><p>指定されたコンテンツが見つかりません。</p></section>';
            return;
        }
        const pagePath = `pages/${pageId}.html`;

        try {
            const response = await fetch(pagePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, for page: ${pageId}`);
            }
            const html = await response.text();
            
            // 既存の .active クラスを持つ要素を削除または非表示に
            const currentActivePage = contentArea.querySelector('.content-page.active');
            if (currentActivePage) {
                currentActivePage.classList.remove('active');
                // トランジションを待つ場合、もう少し複雑な処理が必要
                // ここではシンプルに上書きするので、即時非表示でOK
            }

            contentArea.innerHTML = html; // 新しいコンテンツを挿入
            const newPage = contentArea.querySelector('.content-page'); // 新しく挿入された要素

            if (newPage) {
                // Prism.jsのハイライトを新しいコンテンツに適用
                Prism.highlightAllUnder(newPage);
                
                // CSSトランジションのために、.activeクラスの追加を少し遅らせる
                requestAnimationFrame(() => {
                    // requestAnimationFrame(() => { // Double RAF for some browsers
                        newPage.classList.add('active');
                    // });
                });
                 // スクリプトの再実行が必要なページ（例：視覚化ツール）
                if (pageId === 'selection-sort-learn') {
                    const scriptElement = newPage.querySelector('script[src="../js/selectionSortVisualizer.js"]');
                    if (scriptElement) {
                        // 一度削除して再追加することで再実行を試みる (より堅牢な方法はモジュール化)
                        const newScript = document.createElement('script');
                        newScript.src = scriptElement.src;
                        // scriptElement.remove(); // 古いものを削除
                        // newPage.appendChild(newScript); // 新しいものを追加。ただし、グローバルスコープでの実行に注意
                        // より良いのは、selectionSortVisualizer.jsが初期化関数を公開し、ここで呼ぶこと
                        // 今回は selectionSortVisualizer.js が即時実行関数なので、HTMLにscriptタグを書いておけば
                        // innerHTMLで挿入された際に解釈・実行されることが多い。
                    }
                }


            } else {
                console.error(`Content page structure error for ${pageId}. '.content-page' not found.`);
                contentArea.innerHTML = `<section class="content-page active"><p>コンテンツの読み込みに失敗しました (構造エラー): ${pageId}</p></section>`;
            }

        } catch (error) {
            console.error('Error loading page:', pageId, error);
            contentArea.innerHTML = `<section class="content-page active"><p>エラー: ${pageId} を読み込めませんでした。(${error.message})</p></section>`;
        }
    }

    function handleHashChange() {
        const currentHash = window.location.hash.substring(1);
        let targetPageId = currentHash;

        if (!allPageIds.includes(targetPageId)) {
            targetPageId = allPageIds.length > 0 ? allPageIds[0] : null;
            if (targetPageId && window.location.hash.substring(1) !== targetPageId) {
                // 不正なハッシュの場合、URLを書き換えるが、hashchangeループを避けるため慎重に
                // window.history.replaceState(null, null, '#' + targetPageId); // これだとhashchangeがトリガーされない
            } else if (!targetPageId) {
                 contentArea.innerHTML = '<section class="content-page active"><p>コンテンツがありません。</p></section>';
                 currentPageIndex = -1;
                 updateActiveTocItem(null);
                 updateNavButtons();
                 return;
            }
        }
        
        // 以前の.activeを削除（loadContentPage内でも行うが念のため）
        const currentlyActive = contentArea.querySelector('.content-page.active');
        if(currentlyActive) currentlyActive.classList.remove('active');

        loadContentPage(targetPageId).then(() => {
            currentPageIndex = allPageIds.indexOf(targetPageId);
            if (currentPageIndex === -1 && allPageIds.length > 0) { // フォールバックした場合
                currentPageIndex = 0;
                targetPageId = allPageIds[0];
            }
            updateActiveTocItem(targetPageId);
            updateNavButtons();
            contentArea.scrollTop = 0; // 新しいページ表示時にトップへスクロール
        });
    }

    function updateActiveTocItem(activePageId) {
        tocLinks.forEach(link => {
            if (link.getAttribute('href').substring(1) === activePageId) {
                link.classList.add('active-toc-item');
            } else {
                link.classList.remove('active-toc-item');
            }
        });
    }

    function updateNavButtons() {
        if (!prevButton || !nextButton || allPageIds.length === 0) {
            if(prevButton) prevButton.disabled = true;
            if(nextButton) nextButton.disabled = true;
            return;
        }
        prevButton.disabled = (currentPageIndex <= 0);
        nextButton.disabled = (currentPageIndex >= allPageIds.length - 1);
    }

    function navigateToPage(index) {
        if (index >= 0 && index < allPageIds.length) {
            const pageId = allPageIds[index];
            // ハッシュを変更することで hashchange イベントをトリガー
            window.location.hash = pageId;
        }
    }

    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (currentPageIndex > 0) {
                navigateToPage(currentPageIndex - 1);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            if (currentPageIndex < allPageIds.length - 1) {
                navigateToPage(currentPageIndex + 1);
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (prevButton && !prevButton.disabled) {
                navigateToPage(currentPageIndex - 1);
            }
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (nextButton && !nextButton.disabled) {
                navigateToPage(currentPageIndex + 1);
            }
        }
    });

    initializeApp();
});
