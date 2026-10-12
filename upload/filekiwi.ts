import { Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fetchSourceBuffer, getSourceUrl } from './_shared';

/*
 * PENTING: @file-kiwi/node di-publish sebagai ESM-only. Kalau di-import
 * secara statis, tsc (module: NodeNext, output CommonJS) mengubahnya jadi
 * require() dan Node langsung melempar ERR_REQUIRE_ESM saat file ini
 * di-load -> SEMUA route ikut crash (FUNCTION_INVOCATION_FAILED).
 *
 * Solusi: dimuat LAZY lewat import() dinamis di dalam handler. import()
 * dipertahankan apa adanya oleh tsc (NodeNext) dan boleh dipakai dari
 * modul CommonJS. Dengan begitu server tetap bisa start walau paket ini
 * bermasalah; hanya endpoint upload filekiwi yang terdampak.
 */
let kiwiPromise: Promise<any> | null = null;
function loadKiwi(): Promise<any> {
    if (!kiwiPromise) {
        // @ts-ignore - paket ESM-only, tanpa type declaration untuk CJS
        kiwiPromise = import('@file-kiwi/node').catch((err: any) => {
            kiwiPromise = null;
            throw err;
        });
    }
    return kiwiPromise;
}

export default async function filekiwiHandler(req: Request, res: Response) {
    const sourceUrl = getSourceUrl(req);

    if (!sourceUrl) {
        return res.status(400).json({ status: false, message: "Parameter 'url' diperlukan." });
    }

    const { createWebFolder, startUpload } = await loadKiwi();
    const { buffer, filename } = await fetchSourceBuffer(sourceUrl);

    // @file-kiwi/node butuh path file di disk, jadi file sumber ditulis
    // sementara ke folder temp OS lalu dihapus lagi setelah upload selesai.
    const tmpPath = path.join(os.tmpdir(), `kairoo-filekiwi-${crypto.randomUUID()}-${filename}`);
    fs.writeFileSync(tmpPath, buffer);

    try {
        const webfolder = await createWebFolder({
            title: 'Kairoo Upload',
            files: [{ filepath: tmpPath }]
        });

        await startUpload(webfolder);

        return res.json({
            status: true,
            input: sourceUrl,
            result_url: webfolder.webfolderUrl
        });
    } finally {
        fs.unlink(tmpPath, () => {});
    }
}
