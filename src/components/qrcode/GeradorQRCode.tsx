
'use client';

import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import AppLogo from '../AppLogo';

interface GeradorQRCodeProps {
  url: string;
  title: string;
}

export function GeradorQRCode({ url, title }: GeradorQRCodeProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = () => {
    if (!qrCodeRef.current) return;

    const canvas = qrCodeRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create a new canvas to add a white background and title
    const finalCanvas = document.createElement('canvas');
    const padding = 40;
    const titleHeight = 60;
    finalCanvas.width = canvas.width + padding * 2;
    finalCanvas.height = canvas.height + padding * 2 + titleHeight;
    const ctx = finalCanvas.getContext('2d');

    if (!ctx) return;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Draw QR Code
    ctx.drawImage(canvas, padding, padding);

    // Draw Title
    ctx.fillStyle = 'black';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, finalCanvas.width / 2, canvas.height + padding + 35);
    
    // Trigger download
    const pngUrl = finalCanvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    let downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadLink.download = `qrcode-${sanitizedTitle}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div ref={qrCodeRef} className="p-4 bg-white rounded-lg border">
        <QRCodeCanvas
          value={url}
          size={256}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"H"} // High error correction level, good for including a logo
          includeMargin={true}
          imageSettings={{
            src: "/logo-lt-bg-white.png",
            x: undefined,
            y: undefined,
            height: 48,
            width: 48,
            excavate: true,
          }}
        />
      </div>
       <p className="text-center font-semibold">{title}</p>
      <Button onClick={downloadQRCode} className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Baixar QR Code
      </Button>
    </div>
  );
}
