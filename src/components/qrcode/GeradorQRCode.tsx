
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

    const qrCanvas = qrCodeRef.current.querySelector('canvas');
    if (!qrCanvas) return;

    // Create a new canvas to compose the final image
    const finalCanvas = document.createElement('canvas');
    const padding = 40;
    const titleHeight = 60;
    const headerHeight = 80; // Space for the top logo and text
    
    finalCanvas.width = qrCanvas.width + padding * 2;
    finalCanvas.height = qrCanvas.height + padding * 2 + titleHeight + headerHeight;
    const ctx = finalCanvas.getContext('2d');

    if (!ctx) return;

    // 1. White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // 2. Draw Header (Logo and "Editora LT" text)
    const logoImg = new Image();
    logoImg.src = "/Imagem_do_WhatsApp_de_2025-08-14_à_s__17.07.16_9af64c95-removebg-preview.png"; // Path to your logo
    logoImg.onload = () => {
      const logoWidth = 50;
      const logoHeight = 50;
      const text = "Editora LT";
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#3F51B5'; // primary color
      const textWidth = ctx.measureText(text).width;
      const totalHeaderWidth = logoWidth + 10 + textWidth;
      const startX = (finalCanvas.width - totalHeaderWidth) / 2;

      ctx.drawImage(logoImg, startX, (headerHeight - logoHeight) / 2 + 10, logoWidth, logoHeight);
      ctx.fillText(text, startX + logoWidth + 10, headerHeight / 2 + 20);

      // 3. Draw QR Code
      ctx.drawImage(qrCanvas, padding, headerHeight);

      // 4. Draw Title
      ctx.fillStyle = 'black';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, finalCanvas.width / 2, qrCanvas.height + headerHeight + padding - 10);

      // 5. Trigger download
      const pngUrl = finalCanvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
      let downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadLink.download = `qrcode-${sanitizedTitle}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
    
    logoImg.onerror = (e) => {
        console.error("Failed to load logo for QR download", e);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="p-4 bg-white rounded-lg border" ref={qrCodeRef}>
         <QRCodeCanvas
          value={url}
          size={256}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"H"}
          includeMargin={true}
          imageSettings={{
            src: "/Imagem_do_WhatsApp_de_2025-08-14_à_s__17.07.16_9af64c95-removebg-preview.png",
            height: 50,
            width: 50,
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
