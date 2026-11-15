import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 建置輸出到儲存庫根目錄的 health/，以相對路徑載入，可直接放在 GitHub Pages 子路徑。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../health', emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
