/**
 * Quick QR - Popup Script
 * 現在のタブURLをQRコードに変換して表示
 */

// ==========================================
// 定数・設定
// ==========================================

// QRコードサイズ設定（セルサイズ）
const QR_SIZES = {
    small: 4,
    medium: 6,
    large: 8
};

// QR生成できないURLプレフィックス
const RESTRICTED_URL_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'file://',
    'view-source:',
    'devtools://'
];

// ==========================================
// DOM要素
// ==========================================

const elements = {
    urlDisplay: document.getElementById('urlDisplay'),
    qrContainer: document.getElementById('qrContainer'),
    qrCanvas: document.getElementById('qrCanvas'),
    qrLoading: document.getElementById('qrLoading'),
    sizeSelect: document.getElementById('sizeSelect'),
    copyBtn: document.getElementById('copyBtn'),
    saveBtn: document.getElementById('saveBtn'),
    messageArea: document.getElementById('messageArea')
};

// ==========================================
// グローバル変数
// ==========================================

let currentUrl = '';

// ==========================================
// ユーティリティ関数
// ==========================================

/**
 * メッセージを表示（自動で消える）
 * @param {string} message - 表示するメッセージ
 * @param {string} type - 'success' | 'error' | 'warning'
 * @param {number} duration - 表示時間（ms）
 */
function showMessage(message, type = 'success', duration = 3000) {
    elements.messageArea.textContent = message;
    elements.messageArea.className = `message-area ${type}`;

    setTimeout(() => {
        elements.messageArea.textContent = '';
        elements.messageArea.className = 'message-area';
    }, duration);
}

/**
 * URLが制限されているかチェック
 * @param {string} url - チェックするURL
 * @returns {boolean} - 制限されている場合true
 */
function isRestrictedUrl(url) {
    if (!url) return true;
    return RESTRICTED_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

/**
 * URLを省略表示用にフォーマット
 * @param {string} url - URL
 * @param {number} maxLength - 最大文字数
 * @returns {string} - フォーマットされたURL
 */
function formatUrl(url, maxLength = 80) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
}

// ==========================================
// QRコード生成
// ==========================================

/**
 * QRコードを生成してCanvasに描画
 * @param {string} url - QRコード化するURL
 * @param {string} size - サイズ（'small' | 'medium' | 'large'）
 */
function generateQRCode(url, size = 'medium') {
    if (!url || isRestrictedUrl(url)) {
        showQRError();
        return;
    }

    try {
        // QRコードライブラリの読み込みチェック
        if (typeof qrcode === 'undefined') {
            console.error('QRコードライブラリが読み込まれていません');
            showMessage('QRコードライブラリの読み込みに失敗しました', 'error');
            showQRError();
            return;
        }

        // QRコードインスタンス作成
        const qr = qrcode(0, 'M'); // 0=自動タイプ, M=中程度エラー訂正
        qr.addData(url);
        qr.make();

        // セルサイズとモジュール数を取得
        const cellSize = QR_SIZES[size] || QR_SIZES.medium;
        const moduleCount = qr.getModuleCount();
        const margin = cellSize * 4;
        const canvasSize = moduleCount * cellSize + margin * 2;

        // Canvasサイズ設定
        const canvas = elements.qrCanvas;
        canvas.width = canvasSize;
        canvas.height = canvasSize;

        const ctx = canvas.getContext('2d');

        // 背景を白で塗りつぶし
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // QRコード描画
        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        col * cellSize + margin,
                        row * cellSize + margin,
                        cellSize,
                        cellSize
                    );
                }
            }
        }

        // ローディング非表示
        elements.qrLoading.classList.remove('show');
        elements.qrContainer.classList.remove('error');

        // ボタン有効化
        elements.copyBtn.disabled = false;
        elements.saveBtn.disabled = false;

    } catch (error) {
        console.error('QRコード生成エラー:', error);
        showMessage('QRコードの生成に失敗しました', 'error');
        showQRError();
    }
}

/**
 * QRエラー状態を表示
 */
function showQRError() {
    elements.qrLoading.classList.remove('show');
    elements.qrContainer.classList.add('error');
    elements.qrCanvas.width = 180;
    elements.qrCanvas.height = 180;

    const ctx = elements.qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, 180, 180);

    elements.copyBtn.disabled = true;
    elements.saveBtn.disabled = true;
}

// ==========================================
// アクション関数
// ==========================================

/**
 * URLをクリップボードにコピー
 */
async function copyUrl() {
    if (!currentUrl) {
        showMessage('コピーするURLがありません', 'error');
        return;
    }

    try {
        // navigator.clipboard.writeText を使用（推奨）
        await navigator.clipboard.writeText(currentUrl);
        showMessage('✓ URLをコピーしました', 'success');
    } catch (err) {
        console.error('Clipboard API失敗:', err);

        // フォールバック: execCommand使用
        try {
            const textArea = document.createElement('textarea');
            textArea.value = currentUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showMessage('✓ URLをコピーしました', 'success');
        } catch (fallbackErr) {
            console.error('フォールバックも失敗:', fallbackErr);
            showMessage('コピーに失敗しました。もう一度お試しください', 'error');
        }
    }
}

/**
 * QRコードをPNG画像として保存
 */
function saveQRAsPng() {
    try {
        const canvas = elements.qrCanvas;
        const dataUrl = canvas.toDataURL('image/png');

        // ファイル名生成（URLのドメイン部分を使用）
        let filename = 'qrcode.png';
        try {
            const urlObj = new URL(currentUrl);
            const domain = urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
            filename = `qr_${domain}.png`;
        } catch (e) {
            // URL解析失敗時はデフォルト名を使用
        }

        // ダウンロードリンク作成・クリック
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        showMessage('✓ QRコードを保存しました', 'success');
    } catch (error) {
        console.error('保存エラー:', error);
        showMessage('保存に失敗しました。もう一度お試しください', 'error');
    }
}

// ==========================================
// 初期化
// ==========================================

/**
 * 現在のタブURLを取得してQRコード生成
 */
async function init() {
    // ローディング表示
    elements.qrLoading.classList.add('show');
    elements.copyBtn.disabled = true;
    elements.saveBtn.disabled = true;

    try {
        // 現在アクティブなタブを取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) {
            elements.urlDisplay.textContent = 'URLを取得できませんでした';
            showMessage('URLを取得できませんでした', 'error');
            showQRError();
            return;
        }

        currentUrl = tab.url;

        // URL表示（省略形）+ 完全URLをtitle属性に
        elements.urlDisplay.textContent = formatUrl(currentUrl, 100);
        elements.urlDisplay.title = currentUrl;

        // 制限URLチェック
        if (isRestrictedUrl(currentUrl)) {
            showMessage('このページはQR生成できません（chrome:// など）', 'warning', 5000);
            showQRError();
            return;
        }

        // QRコード生成
        const selectedSize = elements.sizeSelect.value;
        generateQRCode(currentUrl, selectedSize);

    } catch (error) {
        console.error('初期化エラー:', error);
        elements.urlDisplay.textContent = 'URLを取得できませんでした';
        showMessage('URLを取得できませんでした', 'error');
        showQRError();
    }
}

// ==========================================
// イベントリスナー
// ==========================================

// URLクリックでコピー
elements.urlDisplay.addEventListener('click', copyUrl);

// コピーボタン
elements.copyBtn.addEventListener('click', copyUrl);

// 保存ボタン
elements.saveBtn.addEventListener('click', saveQRAsPng);

// サイズ変更
elements.sizeSelect.addEventListener('change', (e) => {
    if (currentUrl && !isRestrictedUrl(currentUrl)) {
        generateQRCode(currentUrl, e.target.value);
    }
});

// 初期化実行
document.addEventListener('DOMContentLoaded', init);
