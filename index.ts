/*
 * ENTRY POINT.
 *
 * Seluruh aplikasi ada di app.ts. File ini hanya membungkusnya supaya kalau
 * ada yang gagal saat server start (mis. ERR_REQUIRE_ESM dari package
 * ESM-only, env hilang, native module gagal), error ASLI-nya tampil sebagai
 * JSON di browser dan tercatat di log, bukan cuma halaman Vercel
 * "500 FUNCTION_INVOCATION_FAILED" tanpa keterangan.
 *
 * Setelah server normal, wrapper ini tidak mengubah perilaku apa pun.
 */
import express from 'express';

let realApp: any = null;
let bootError: any = null;

try {
    realApp = require('./app').default;
} catch (error: any) {
    bootError = error;
    console.error('[FATAL] Server gagal start:', (error && error.stack) || error);
}

const entry = express();

entry.use((req: any, res: any, next: any) => {
    if (bootError) {
        return res.status(500).json({
            status: false,
            message: 'Server gagal start (error saat memuat aplikasi).',
            node: process.version,
            error: {
                name: bootError && bootError.name,
                code: bootError && bootError.code,
                message: String((bootError && bootError.message) || bootError).slice(0, 1500),
                stack: String((bootError && bootError.stack) || '').split('\n').slice(0, 15)
            }
        });
    }
    return realApp(req, res, next);
});

/*
 * app.listen() hanya jalan kalau file ini dieksekusi langsung
 * (`node dist/index.js` / `ts-node index.ts` di VPS/Termux). Di Vercel
 * file ini di-require sehingga tidak ada listener.
 */
if (require.main === module) {
    const port = Number(process.env.PORT) || 3000;
    entry.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

export default entry;
