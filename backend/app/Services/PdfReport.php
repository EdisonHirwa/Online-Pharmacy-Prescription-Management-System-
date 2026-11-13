<?php

namespace App\Services;

class PdfReport
{
    public static function render(string $title, array $lines): string
    {
        $pages = array_chunk(array_merge([$title, 'Generated: '.now()->toIso8601String(), ''], $lines), 48);
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>', 3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];
        $kids = [];
        foreach ($pages as $i => $page) {
            $pageId = 4 + $i * 2;
            $streamId = $pageId + 1;
            $kids[] = $pageId.' 0 R';
            $stream = "BT /F1 9 Tf 35 805 Td 14 TL\n";
            foreach ($page as $line) {
                $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string) $line) ?: '';
                $escaped = str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $ascii);
                $stream .= '('.$escaped.") Tj T*\n";
            }
            $stream .= 'ET';
            $objects[$pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '.$streamId.' 0 R >>';
            $objects[$streamId] = '<< /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream";
        }
        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($pages).' >>';
        ksort($objects);
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= $id." 0 obj\n".$body."\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($objects as $id => $body) {
            $pdf .= sprintf('%010d 00000 n ', $offsets[$id])."\n";
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF";
    }
}
