"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  RotateCcw,
  Move,
  Maximize2,
  Loader2,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { jsPDF } from "jspdf";

interface Point {
  x: number;
  y: number;
}

interface DocumentCropperProps {
  imageUrl: string;
  onCropped: (croppedFile: File) => void;
  onCancel: () => void;
}

// =============================================================================
// MAGNIFIER CONSTANTS
// =============================================================================
const MAGNIFIER_SIZE = 100; // px diameter of the magnifier circle
const MAGNIFIER_ZOOM = 3;  // zoom level inside the magnifier
const MAGNIFIER_OFFSET_Y = -80; // px above the touch point
const MAGNIFIER_OFFSET_X_EDGE = 70; // px offset when near edges
const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"];
const EDGE_LABELS = ["Top", "Right", "Bottom", "Left"];

// Edge handle: indices of the two corners that form each edge
// Edge 0 = top (corners 0→1), Edge 1 = right (1→2), Edge 2 = bottom (2→3), Edge 3 = left (3→0)
const EDGE_CORNERS: [number, number][] = [[0,1],[1,2],[2,3],[3,0]];

// Solve a 3x3 linear system using Cramer's rule helpers
function solve3x3(A: number[][], b: number[]): number[] {
  const det = (
    A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  );
  if (Math.abs(det) < 1e-10) return [0, 0, 0];

  const x = (
    b[0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
    A[0][1] * (b[1] * A[2][2] - A[1][2] * b[2]) +
    A[0][2] * (b[1] * A[2][1] - A[1][1] * b[2])
  ) / det;

  const y = (
    A[0][0] * (b[1] * A[2][2] - A[1][2] * b[2]) -
    b[0] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
    A[0][2] * (A[1][0] * b[2] - b[1] * A[2][0])
  ) / det;

  const z = (
    A[0][0] * (A[1][1] * b[2] - b[1] * A[2][1]) -
    A[0][1] * (A[1][0] * b[2] - b[1] * A[2][0]) +
    b[0] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
  ) / det;

  return [x, y, z];
}

// Compute perspective transform matrix from 4 source points to 4 dest points
function computePerspectiveTransform(
  src: Point[],
  dst: Point[]
): number[] {
  // Using the adjugate method for projective mapping
  // Maps src quad to dst quad
  // Returns 3x3 matrix as flat array [a,b,c,d,e,f,g,h,1]

  function basisToPoints(p0: Point, p1: Point, p2: Point, p3: Point): number[] {
    const m = [
      [p0.x, p1.x, p2.x],
      [p0.y, p1.y, p2.y],
      [1, 1, 1],
    ];
    const coeffs = solve3x3(m, [p3.x, p3.y, 1]);
    return [
      coeffs[0] * p0.x, coeffs[1] * p1.x, coeffs[2] * p2.x,
      coeffs[0] * p0.y, coeffs[1] * p1.y, coeffs[2] * p2.y,
      coeffs[0], coeffs[1], coeffs[2],
    ];
  }

  function multiply3x3(a: number[], b: number[]): number[] {
    const r: number[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        r[i * 3 + j] =
          a[i * 3 + 0] * b[0 * 3 + j] +
          a[i * 3 + 1] * b[1 * 3 + j] +
          a[i * 3 + 2] * b[2 * 3 + j];
      }
    }
    return r;
  }

  function adjugate3x3(m: number[]): number[] {
    return [
      m[4] * m[8] - m[5] * m[7],
      m[2] * m[7] - m[1] * m[8],
      m[1] * m[5] - m[2] * m[4],
      m[5] * m[6] - m[3] * m[8],
      m[0] * m[8] - m[2] * m[6],
      m[2] * m[3] - m[0] * m[5],
      m[3] * m[7] - m[4] * m[6],
      m[1] * m[6] - m[0] * m[7],
      m[0] * m[4] - m[1] * m[3],
    ];
  }

  const srcBasis = basisToPoints(src[0], src[1], src[2], src[3]);
  const dstBasis = basisToPoints(dst[0], dst[1], dst[2], dst[3]);
  const srcAdj = adjugate3x3(srcBasis);
  return multiply3x3(dstBasis, srcAdj);
}

// Apply perspective transform to warp the image
function perspectiveWarp(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[],
  outputWidth: number,
  outputHeight: number
): HTMLCanvasElement {
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outputWidth;
  outCanvas.height = outputHeight;
  const outCtx = outCanvas.getContext("2d")!;
  
  const srcCtx = sourceCanvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const outData = outCtx.createImageData(outputWidth, outputHeight);

  // Source points (the 4 corners the user placed)
  const src = corners;
  // Destination points (the output rectangle)
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outputWidth, y: 0 },
    { x: outputWidth, y: outputHeight },
    { x: 0, y: outputHeight },
  ];

  // We need the INVERSE transform: for each output pixel, find source pixel
  // So we compute dst->src transform
  const matrix = computePerspectiveTransform(dst, src);

  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Apply transform
      const w = matrix[6] * x + matrix[7] * y + matrix[8];
      if (Math.abs(w) < 1e-10) continue;
      const srcX = (matrix[0] * x + matrix[1] * y + matrix[2]) / w;
      const srcY = (matrix[3] * x + matrix[4] * y + matrix[5]) / w;

      // Bilinear interpolation
      const sx = Math.floor(srcX);
      const sy = Math.floor(srcY);
      if (sx < 0 || sx >= sw - 1 || sy < 0 || sy >= sh - 1) continue;

      const fx = srcX - sx;
      const fy = srcY - sy;

      const idx00 = (sy * sw + sx) * 4;
      const idx10 = (sy * sw + sx + 1) * 4;
      const idx01 = ((sy + 1) * sw + sx) * 4;
      const idx11 = ((sy + 1) * sw + sx + 1) * 4;
      const outIdx = (y * outputWidth + x) * 4;

      for (let c = 0; c < 4; c++) {
        outData.data[outIdx + c] = Math.round(
          srcData.data[idx00 + c] * (1 - fx) * (1 - fy) +
          srcData.data[idx10 + c] * fx * (1 - fy) +
          srcData.data[idx01 + c] * (1 - fx) * fy +
          srcData.data[idx11 + c] * fx * fy
        );
      }
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}

// =============================================================================
// ROBUST RECEIPT EDGE DETECTION
// Uses multiple strategies: edge detection (Sobel), brightness analysis, and
// gradient projection to find receipt boundaries on ANY background.
// =============================================================================

function autoDetectReceiptEdges(img: HTMLImageElement): Point[] | null {
  try {
    // Work on a downscaled version for speed (larger = better accuracy)
    const MAX_DIM = 600;
    const scale = Math.min(MAX_DIM / img.naturalWidth, MAX_DIM / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // === Step 1: Convert to grayscale ===
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    // === Step 2: Gaussian blur (5x5) for better noise reduction ===
    const blurred = new Float32Array(w * h);
    const k5 = [1,4,6,4,1, 4,16,24,16,4, 6,24,36,24,6, 4,16,24,16,4, 1,4,6,4,1]; // sum=256
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        let val = 0, ki = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            val += gray[(y + dy) * w + (x + dx)] * k5[ki++];
          }
        }
        blurred[y * w + x] = val / 256;
      }
    }
    // Copy edges
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y < 2 || y >= h - 2 || x < 2 || x >= w - 2) blurred[y * w + x] = gray[y * w + x];
    }

    // === Step 3: Sobel edge detection ===
    const edgeMag = new Float32Array(w * h);
    let maxEdge = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const tl = blurred[(y-1)*w+(x-1)], t = blurred[(y-1)*w+x], tr = blurred[(y-1)*w+(x+1)];
        const l = blurred[y*w+(x-1)], r = blurred[y*w+(x+1)];
        const bl = blurred[(y+1)*w+(x-1)], b = blurred[(y+1)*w+x], br = blurred[(y+1)*w+(x+1)];
        const gx = -tl - 2*l - bl + tr + 2*r + br;
        const gy = -tl - 2*t - tr + bl + 2*b + br;
        const mag = Math.sqrt(gx*gx + gy*gy);
        edgeMag[y*w+x] = mag;
        if (mag > maxEdge) maxEdge = mag;
      }
    }
    if (maxEdge > 0) for (let i = 0; i < edgeMag.length; i++) edgeMag[i] = (edgeMag[i] / maxEdge) * 255;

    // === Step 4: Compute edge projection profiles ===
    const EDGE_THRESH = 20;
    const rowProfile = new Float32Array(h);
    const colProfile = new Float32Array(w);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = 0; x < w; x++) if (edgeMag[y*w+x] > EDGE_THRESH) sum += edgeMag[y*w+x];
      rowProfile[y] = sum;
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y < h; y++) if (edgeMag[y*w+x] > EDGE_THRESH) sum += edgeMag[y*w+x];
      colProfile[x] = sum;
    }

    // Smooth profiles
    function smooth(p: Float32Array, win: number): Float32Array {
      const r = new Float32Array(p.length);
      const half = Math.floor(win / 2);
      for (let i = 0; i < p.length; i++) {
        let s = 0, c = 0;
        for (let j = Math.max(0, i-half); j <= Math.min(p.length-1, i+half); j++) { s += p[j]; c++; }
        r[i] = s / c;
      }
      return r;
    }
    const sRow = smooth(rowProfile, Math.max(5, Math.floor(h * 0.04)));
    const sCol = smooth(colProfile, Math.max(5, Math.floor(w * 0.04)));

    // === Step 5: Find boundaries via DERIVATIVE PEAKS ===
    // The derivative of the profile spikes at receipt edges.
    // Positive derivative = entering receipt region, negative = leaving.
    function findBoundaries(profile: Float32Array, dim: number): { lo: number; hi: number } | null {
      const margin = Math.floor(dim * 0.02);
      const deriv = new Float32Array(dim);
      for (let i = 1; i < dim - 1; i++) deriv[i] = profile[i + 1] - profile[i - 1];

      // Smooth derivative to avoid noise peaks
      const sDeriv = smooth(deriv, Math.max(3, Math.floor(dim * 0.03)));

      // Find strongest positive peak in first half (start of receipt)
      // and strongest negative peak in second half (end of receipt)
      let maxPos = 0, maxPosIdx = margin;
      let maxNeg = 0, maxNegIdx = dim - margin - 1;

      // Search wider zones for the peaks
      const searchEnd = Math.floor(dim * 0.55);
      const searchStart = Math.floor(dim * 0.45);

      for (let i = margin; i < searchEnd; i++) {
        if (sDeriv[i] > maxPos) { maxPos = sDeriv[i]; maxPosIdx = i; }
      }
      for (let i = dim - margin - 1; i > searchStart; i--) {
        if (-sDeriv[i] > maxNeg) { maxNeg = -sDeriv[i]; maxNegIdx = i; }
      }

      // Validate that we found meaningful edges
      const avgProfile = profile.reduce((a, b) => a + b, 0) / dim;
      const peakThresh = avgProfile * 0.15;

      if (maxPos < peakThresh && maxNeg < peakThresh) {
        // Fallback: use threshold-crossing approach
        const thresh = avgProfile * 0.4;
        let lo = margin, hi = dim - margin - 1;
        for (let i = margin; i < Math.floor(dim * 0.45); i++) {
          if (profile[i] > thresh) { lo = i; break; }
        }
        for (let i = dim - margin - 1; i > Math.floor(dim * 0.55); i--) {
          if (profile[i] > thresh) { hi = i; break; }
        }
        return { lo, hi };
      }

      return { lo: maxPosIdx, hi: maxNegIdx };
    }

    const hBounds = findBoundaries(sRow, h);
    const vBounds = findBoundaries(sCol, w);
    if (!hBounds || !vBounds) return null;

    let topY = hBounds.lo, bottomY = hBounds.hi;
    let leftX = vBounds.lo, rightX = vBounds.hi;

    // === Step 6: Otsu brightness refinement ===
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) histogram[Math.round(Math.min(255, Math.max(0, gray[i])))]++;
    let total = gray.length, graySum = 0;
    for (let i = 0; i < 256; i++) graySum += i * histogram[i];
    let sumB = 0, wB = 0, wF = 0, maxVar = 0, otsuThresh = 128;
    for (let t = 0; t < 256; t++) {
      wB += histogram[t]; if (wB === 0) continue;
      wF = total - wB; if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB, mF = (graySum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; otsuThresh = t; }
    }

    // Compare interior vs exterior brightness
    let intB = 0, intC = 0, extB = 0, extC = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= leftX && x <= rightX && y >= topY && y <= bottomY) { intB += gray[y*w+x]; intC++; }
      else { extB += gray[y*w+x]; extC++; }
    }
    const avgInt = intC > 0 ? intB / intC : 128;
    const avgExt = extC > 0 ? extB / extC : 128;

    if (Math.abs(avgInt - avgExt) > 12) {
      const bright = avgInt > avgExt;
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < gray.length; i++) mask[i] = bright ? (gray[i] > otsuThresh ? 1 : 0) : (gray[i] < otsuThresh ? 1 : 0);

      const DENS = 0.3;
      const m = Math.floor(Math.max(w, h) * 0.02);
      // Refine each boundary
      for (let y = Math.max(m, topY - Math.floor(h*0.06)); y < Math.min(topY + Math.floor(h*0.12), Math.floor(h*0.45)); y++) {
        let c = 0; for (let x = leftX; x <= rightX; x++) if (mask[y*w+x]) c++;
        if (c / (rightX-leftX+1) >= DENS) { topY = y; break; }
      }
      for (let y = Math.min(h-m-1, bottomY + Math.floor(h*0.06)); y > Math.max(bottomY - Math.floor(h*0.12), Math.floor(h*0.55)); y--) {
        let c = 0; for (let x = leftX; x <= rightX; x++) if (mask[y*w+x]) c++;
        if (c / (rightX-leftX+1) >= DENS) { bottomY = y; break; }
      }
      for (let x = Math.max(m, leftX - Math.floor(w*0.06)); x < Math.min(leftX + Math.floor(w*0.12), Math.floor(w*0.45)); x++) {
        let c = 0; for (let y = topY; y <= bottomY; y++) if (mask[y*w+x]) c++;
        if (c / (bottomY-topY+1) >= DENS) { leftX = x; break; }
      }
      for (let x = Math.min(w-m-1, rightX + Math.floor(w*0.06)); x > Math.max(rightX - Math.floor(w*0.12), Math.floor(w*0.55)); x--) {
        let c = 0; for (let y = topY; y <= bottomY; y++) if (mask[y*w+x]) c++;
        if (c / (bottomY-topY+1) >= DENS) { rightX = x; break; }
      }
    }

    // === Step 7: Validate ===
    const rW = (rightX - leftX) / w;
    const rH = (bottomY - topY) / h;
    if (rW < 0.15 || rH < 0.15) return null;
    if (rW > 0.97 && rH > 0.97) return null;

    // === Step 8: Return corners with small padding ===
    const pad = 0.008;
    return [
      { x: Math.max(0, leftX / w - pad), y: Math.max(0, topY / h - pad) },
      { x: Math.min(1, rightX / w + pad), y: Math.max(0, topY / h - pad) },
      { x: Math.min(1, rightX / w + pad), y: Math.min(1, bottomY / h + pad) },
      { x: Math.max(0, leftX / w - pad), y: Math.min(1, bottomY / h + pad) },
    ];
  } catch (err) {
    console.error("Auto-detect failed:", err);
    return null;
  }
}

export default function DocumentCropper({ imageUrl, onCropped, onCancel }: DocumentCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [processing, setProcessing] = useState(false);
  // 0-3 = corner handles, 4-7 = edge midpoint handles (edge 0=top, 1=right, 2=bottom, 3=left)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragStartNorm, setDragStartNorm] = useState<Point | null>(null); // for edge drag delta
  const [dragStartCorners, setDragStartCorners] = useState<Point[] | null>(null);
  const [touchPos, setTouchPos] = useState<Point | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [autoDetected, setAutoDetected] = useState(false);
  // Corners in normalized coordinates (0-1)
  const [corners, setCorners] = useState<Point[]>([
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.08 },
    { x: 0.92, y: 0.92 },
    { x: 0.08, y: 0.92 },
  ]);

  const HANDLE_RADIUS = 14;

  // Run auto-detection on a loaded image
  const runAutoDetect = useCallback((img: HTMLImageElement) => {
    setDetecting(true);
    // Use requestAnimationFrame to allow the "detecting" UI to paint first
    requestAnimationFrame(() => {
      setTimeout(() => {
        const detected = autoDetectReceiptEdges(img);
        if (detected) {
          setCorners(detected);
          setAutoDetected(true);
        } else {
          setAutoDetected(false);
        }
        setDetecting(false);
      }, 50); // Small delay so the spinner shows
    });
  }, []);

  // Load image and auto-detect receipt edges
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setLoaded(true);

      // Automatically detect edges after image loads
      runAutoDetect(img);
    };
    img.src = imageUrl;
  }, [imageUrl, runAutoDetect]);

  // Compute display dimensions
  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const container = containerRef.current;
    const maxW = container.clientWidth;
    const maxH = 500;
    const aspect = imgSize.w / imgSize.h;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    setDisplaySize({ w: Math.round(w), h: Math.round(h) });
  }, [loaded, imgSize]);

  // Draw the overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext("2d")!;
    const { w, h } = displaySize;

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    // Draw source image
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, w, h);
    }

    // Draw darkened overlay outside the crop region
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, w, h);
    
    // Cut out the quadrilateral
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    const pts = corners.map(c => ({ x: c.x * w, y: c.y * h }));
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- Metallic chrome edge lines (matching tile icon aesthetic) ---
    // Helper: draw the quad path
    const drawQuad = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= 4; i++) ctx.lineTo(pts[i % 4].x, pts[i % 4].y);
      ctx.closePath();
    };

    // Layer 1: Deep shadow (dark base)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = "rgba(30, 40, 50, 0.7)";
    ctx.lineWidth = 6;
    ctx.setLineDash([]);
    drawQuad();
    ctx.stroke();
    ctx.restore();

    // Layer 2: Chrome body (silver gradient per edge segment)
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      // Gradient perpendicular to the edge for metallic sheen
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) continue;
      // Normal direction (perpendicular)
      const nx = -dy / len;
      const ny = dx / len;
      const grad = ctx.createLinearGradient(
        mx + nx * 4, my + ny * 4,
        mx - nx * 4, my - ny * 4
      );
      grad.addColorStop(0, "rgba(220, 230, 240, 0.95)");   // bright highlight
      grad.addColorStop(0.3, "rgba(180, 195, 210, 0.9)");  // silver
      grad.addColorStop(0.5, "rgba(140, 160, 180, 0.85)"); // mid-chrome
      grad.addColorStop(0.7, "rgba(100, 120, 140, 0.9)");  // shadow
      grad.addColorStop(1, "rgba(160, 180, 200, 0.92)");   // secondary highlight

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Layer 3: Teal accent highlight (thin inner line with glow)
    ctx.save();
    ctx.shadowColor = "rgba(0, 200, 180, 0.45)";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(0, 210, 190, 0.55)";
    ctx.lineWidth = 1;
    drawQuad();
    ctx.stroke();
    ctx.restore();

    // Layer 4: Specular highlight (very thin bright line offset)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 2) continue;
      const nx = -dy / len;
      const ny = dx / len;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * 1.2, a.y + ny * 1.2);
      ctx.lineTo(b.x + nx * 1.2, b.y + ny * 1.2);
      ctx.stroke();
    }

    // --- Edge midpoint handles (metallic pill bars) ---
    for (let ei = 0; ei < 4; ei++) {
      const [ci, cj] = EDGE_CORNERS[ei];
      const midX = (pts[ci].x + pts[cj].x) / 2;
      const midY = (pts[ci].y + pts[cj].y) / 2;
      
      const dx = pts[cj].x - pts[ci].x;
      const dy = pts[cj].y - pts[ci].y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen < 2) continue;
      
      const isActive = draggingIdx === (ei + 4);
      const barHalfLen = 16;
      const barThick = isActive ? 6 : 4.5;
      const angle = Math.atan2(dy, dx);
      
      ctx.save();
      ctx.translate(midX, midY);
      ctx.rotate(angle);
      
      // Shadow under pill
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = isActive ? 10 : 5;
      ctx.shadowOffsetY = 1;
      
      // Metallic gradient fill (vertical across pill thickness)
      const pillGrad = ctx.createLinearGradient(0, -barThick, 0, barThick);
      if (isActive) {
        pillGrad.addColorStop(0, "#e0f0f0");
        pillGrad.addColorStop(0.3, "#00d4be");
        pillGrad.addColorStop(0.6, "#00a89a");
        pillGrad.addColorStop(1, "#b0e8e0");
      } else {
        pillGrad.addColorStop(0, "#e8eef4");   // bright top
        pillGrad.addColorStop(0.35, "#c0cdd8"); // silver
        pillGrad.addColorStop(0.65, "#8a9baa"); // darker chrome
        pillGrad.addColorStop(1, "#d0dae2");    // bottom reflection
      }
      
      ctx.beginPath();
      ctx.roundRect(-barHalfLen, -barThick, barHalfLen * 2, barThick * 2, barThick);
      ctx.fillStyle = pillGrad;
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      // Chrome rim
      ctx.strokeStyle = isActive ? "rgba(0, 210, 190, 0.8)" : "rgba(160, 180, 200, 0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Specular highlight line along top of pill
      ctx.beginPath();
      ctx.roundRect(-barHalfLen + 3, -barThick + 1, (barHalfLen - 3) * 2, 2, 1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fill();
      
      // Center notch groove
      ctx.beginPath();
      ctx.moveTo(0, -barThick + 2.5);
      ctx.lineTo(0, barThick - 2.5);
      ctx.strokeStyle = isActive ? "rgba(255,255,255,0.5)" : "rgba(80, 100, 120, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }

    // --- Corner handles (metallic L-bracket style) ---
    const bracketLen = 20;
    const bracketW = 3.5;
    pts.forEach((pt, idx) => {
      const isActive = draggingIdx === idx;
      const dirX = (idx === 0 || idx === 3) ? 1 : -1;
      const dirY = (idx === 0 || idx === 1) ? 1 : -1;
      
      // Shadow layer
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = isActive ? 12 : 6;
      ctx.shadowOffsetY = 1;
      
      // Dark base stroke for depth
      ctx.strokeStyle = "rgba(40, 55, 70, 0.8)";
      ctx.lineWidth = bracketW + 2 + (isActive ? 1 : 0);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + dirX * bracketLen, pt.y);
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x, pt.y + dirY * bracketLen);
      ctx.stroke();
      ctx.restore();
      
      // Chrome/silver bracket arms
      // Horizontal arm gradient
      const hGrad = ctx.createLinearGradient(pt.x, pt.y - 2, pt.x, pt.y + 2);
      hGrad.addColorStop(0, isActive ? "#b0f0e8" : "#dce6f0");
      hGrad.addColorStop(0.4, isActive ? "#00d4be" : "#b0c0d0");
      hGrad.addColorStop(0.7, isActive ? "#008878" : "#7a90a5");
      hGrad.addColorStop(1, isActive ? "#60d8c8" : "#c5d2dc");
      
      ctx.strokeStyle = hGrad;
      ctx.lineWidth = bracketW + (isActive ? 1 : 0);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x + dirX * bracketLen, pt.y);
      ctx.stroke();
      
      // Vertical arm gradient
      const vGrad = ctx.createLinearGradient(pt.x - 2, pt.y, pt.x + 2, pt.y);
      vGrad.addColorStop(0, isActive ? "#b0f0e8" : "#dce6f0");
      vGrad.addColorStop(0.4, isActive ? "#00d4be" : "#b0c0d0");
      vGrad.addColorStop(0.7, isActive ? "#008878" : "#7a90a5");
      vGrad.addColorStop(1, isActive ? "#60d8c8" : "#c5d2dc");
      
      ctx.strokeStyle = vGrad;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x, pt.y + dirY * bracketLen);
      ctx.stroke();
      
      // Specular highlight along arms (thin bright line)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - 1);
      ctx.lineTo(pt.x + dirX * (bracketLen - 2), pt.y - 1);
      ctx.moveTo(pt.x - 1, pt.y);
      ctx.lineTo(pt.x - 1, pt.y + dirY * (bracketLen - 2));
      ctx.stroke();
      
      // Corner jewel (metallic orb)
      const orbR = isActive ? 5.5 : 4.5;
      const orbGrad = ctx.createRadialGradient(
        pt.x - orbR * 0.3, pt.y - orbR * 0.3, orbR * 0.1,
        pt.x, pt.y, orbR
      );
      if (isActive) {
        orbGrad.addColorStop(0, "#ffffff");
        orbGrad.addColorStop(0.3, "#80ffe8");
        orbGrad.addColorStop(0.7, "#00c4a8");
        orbGrad.addColorStop(1, "#006858");
      } else {
        orbGrad.addColorStop(0, "#ffffff");
        orbGrad.addColorStop(0.3, "#d8e4ee");
        orbGrad.addColorStop(0.7, "#95aabb");
        orbGrad.addColorStop(1, "#5a7080");
      }
      
      ctx.save();
      ctx.shadowColor = isActive ? "rgba(0, 200, 180, 0.5)" : "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = isActive ? 10 : 4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, orbR, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();
      ctx.restore();
      
      // Orb rim
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, orbR, 0, Math.PI * 2);
      ctx.strokeStyle = isActive ? "rgba(0, 210, 190, 0.6)" : "rgba(120, 140, 160, 0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
    ctx.lineCap = "butt";
  }, [corners, displaySize, loaded, draggingIdx]);

  // Draw magnifier loupe when dragging a corner or edge
  const drawMagnifier = useCallback(() => {
    const magCanvas = magnifierCanvasRef.current;
    if (!magCanvas || draggingIdx === null || !touchPos || !imageRef.current) return;
    
    const ctx = magCanvas.getContext("2d")!;
    const { w, h } = displaySize;
    const size = MAGNIFIER_SIZE;
    
    magCanvas.width = size;
    magCanvas.height = size;
    
    // Source region center on the full-res image
    let srcCenterX: number, srcCenterY: number;
    if (draggingIdx < 4) {
      // Corner
      srcCenterX = corners[draggingIdx].x * imgSize.w;
      srcCenterY = corners[draggingIdx].y * imgSize.h;
    } else {
      // Edge midpoint
      const [ci, cj] = EDGE_CORNERS[draggingIdx - 4];
      srcCenterX = ((corners[ci].x + corners[cj].x) / 2) * imgSize.w;
      srcCenterY = ((corners[ci].y + corners[cj].y) / 2) * imgSize.h;
    }
    
    // How many source pixels map into the magnifier at this zoom level
    // We use the ratio between display and full image to scale zoom appropriately
    const scaleX = imgSize.w / w;
    const scaleY = imgSize.h / h;
    const srcRegionW = (size * scaleX) / MAGNIFIER_ZOOM;
    const srcRegionH = (size * scaleY) / MAGNIFIER_ZOOM;
    
    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw zoomed image region
    ctx.drawImage(
      imageRef.current,
      srcCenterX - srcRegionW / 2,
      srcCenterY - srcRegionH / 2,
      srcRegionW,
      srcRegionH,
      0,
      0,
      size,
      size
    );
    
    // Draw crosshair at center
    ctx.strokeStyle = "rgba(0, 210, 190, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    // Vertical
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw corner handle indicator at center (metallic orb)
    const dotGrad = ctx.createRadialGradient(size/2 - 1.5, size/2 - 1.5, 0.5, size/2, size/2, 5);
    dotGrad.addColorStop(0, "#ffffff");
    dotGrad.addColorStop(0.4, "#80ffe8");
    dotGrad.addColorStop(1, "#00a890");
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = dotGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 220, 230, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
    
    // Metallic ring border (chrome gradient)
    const ringGrad = ctx.createLinearGradient(0, 0, size, size);
    ringGrad.addColorStop(0, "#dce6f0");
    ringGrad.addColorStop(0.3, "#95aabb");
    ringGrad.addColorStop(0.5, "#c5d2dc");
    ringGrad.addColorStop(0.7, "#7a90a5");
    ringGrad.addColorStop(1, "#b0c0d0");
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // Outer shadow ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 + 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw handle label
    ctx.fillStyle = "rgba(20, 30, 40, 0.8)";
    const labelText = draggingIdx < 4 ? CORNER_LABELS[draggingIdx] : `${EDGE_LABELS[draggingIdx - 4]} Edge`;
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    const textMetrics = ctx.measureText(labelText);
    const labelW = textMetrics.width + 8;
    const labelH = 16;
    const labelX = (size - labelW) / 2;
    const labelY = size - labelH - 6;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 210, 190, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, size / 2, labelY + labelH / 2);
  }, [draggingIdx, touchPos, corners, displaySize, imgSize]);

  useEffect(() => {
    draw();
    drawMagnifier();
  }, [draw, drawMagnifier]);

  // Compute magnifier position — offset above and to the side of the touch point
  const getMagnifierStyle = useCallback((): React.CSSProperties => {
    if (draggingIdx === null || !touchPos) return { display: "none" };
    const { w, h } = displaySize;
    let cpx: number, cpy: number;
    if (draggingIdx < 4) {
      cpx = corners[draggingIdx].x * w;
      cpy = corners[draggingIdx].y * h;
    } else {
      const [ci, cj] = EDGE_CORNERS[draggingIdx - 4];
      cpx = ((corners[ci].x + corners[cj].x) / 2) * w;
      cpy = ((corners[ci].y + corners[cj].y) / 2) * h;
    }
    
    const half = MAGNIFIER_SIZE / 2;
    
    // Default: center above the corner
    let magX = cpx - half;
    let magY = cpy + MAGNIFIER_OFFSET_Y - half;
    
    // If too close to top, show below instead
    if (magY < -half) {
      magY = cpy + 60 - half;
    }
    
    // If too close to left edge, push right
    if (magX < 4) {
      magX = cpx + MAGNIFIER_OFFSET_X_EDGE - half;
    }
    // If too close to right edge, push left
    if (magX + MAGNIFIER_SIZE > w - 4) {
      magX = cpx - MAGNIFIER_OFFSET_X_EDGE - half;
    }
    
    // Ensure still within bounds
    magX = Math.max(-half * 0.3, Math.min(w - half * 0.7, magX));
    magY = Math.max(-half * 0.3, Math.min(h - half * 0.7, magY));
    
    return {
      position: "absolute" as const,
      left: magX,
      top: magY,
      width: MAGNIFIER_SIZE,
      height: MAGNIFIER_SIZE,
      borderRadius: "50%",
      pointerEvents: "none" as const,
      zIndex: 50,
      boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 10px rgba(0,200,180,0.2)",
    };
  }, [draggingIdx, touchPos, corners, displaySize]);

  // Convert page coordinates to normalized canvas coordinates
  const pageToNorm = useCallback(
    (pageX: number, pageY: number): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (pageX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (pageY - rect.top) / rect.height)),
      };
    },
    []
  );

  // Find which handle is under the pointer (corners 0-3 first, then edges 4-7)
  const hitTest = useCallback(
    (pageX: number, pageY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const px = pageX - rect.left;
      const py = pageY - rect.top;
      const { w, h } = displaySize;

      // Check corners first (higher priority)
      for (let i = 0; i < corners.length; i++) {
        const cx = corners[i].x * w;
        const cy = corners[i].y * h;
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist <= HANDLE_RADIUS + 10) return i;
      }
      
      // Check edge midpoint handles
      const EDGE_HIT_RADIUS = 22; // generous touch target
      for (let ei = 0; ei < 4; ei++) {
        const [ci, cj] = EDGE_CORNERS[ei];
        const midX = (corners[ci].x * w + corners[cj].x * w) / 2;
        const midY = (corners[ci].y * h + corners[cj].y * h) / 2;
        const dist = Math.sqrt((px - midX) ** 2 + (py - midY) ** 2);
        if (dist <= EDGE_HIT_RADIUS) return ei + 4; // edges are indices 4-7
      }
      
      return null;
    },
    [corners, displaySize]
  );

  // Pointer handlers (mouse + touch)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const idx = hitTest(e.clientX, e.clientY);
      if (idx !== null) {
        setDraggingIdx(idx);
        const norm = pageToNorm(e.clientX, e.clientY);
        setDragStartNorm(norm);
        setDragStartCorners([...corners]);
        // Track touch position relative to canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          setTouchPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [hitTest, pageToNorm, corners]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIdx === null) return;
      e.preventDefault();
      const norm = pageToNorm(e.clientX, e.clientY);
      
      if (draggingIdx < 4) {
        // Corner drag — move single corner
        setCorners((prev) => {
          const next = [...prev];
          next[draggingIdx] = norm;
          return next;
        });
      } else if (dragStartNorm && dragStartCorners) {
        // Edge drag — move both corners of the edge by the perpendicular delta
        const edgeIdx = draggingIdx - 4;
        const [ci, cj] = EDGE_CORNERS[edgeIdx];
        const dx = norm.x - dragStartNorm.x;
        const dy = norm.y - dragStartNorm.y;
        
        setCorners((prev) => {
          const next = [...prev];
          next[ci] = {
            x: Math.max(0, Math.min(1, dragStartCorners[ci].x + dx)),
            y: Math.max(0, Math.min(1, dragStartCorners[ci].y + dy)),
          };
          next[cj] = {
            x: Math.max(0, Math.min(1, dragStartCorners[cj].x + dx)),
            y: Math.max(0, Math.min(1, dragStartCorners[cj].y + dy)),
          };
          return next;
        });
      }
      
      // Update touch position for magnifier
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setTouchPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    },
    [draggingIdx, pageToNorm, dragStartNorm, dragStartCorners]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingIdx(null);
    setTouchPos(null);
    setDragStartNorm(null);
    setDragStartCorners(null);
  }, []);

  const handleReset = () => {
    setCorners([
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ]);
  };

  const handleAutoFit = () => {
    // Snap corners to just inside the image edges
    setCorners([
      { x: 0.02, y: 0.02 },
      { x: 0.98, y: 0.02 },
      { x: 0.98, y: 0.98 },
      { x: 0.02, y: 0.98 },
    ]);
  };

  const handleCropAndFlatten = async () => {
    if (!imageRef.current) return;
    setProcessing(true);

    try {
      // Create full-res source canvas
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = imgSize.w;
      srcCanvas.height = imgSize.h;
      const srcCtx = srcCanvas.getContext("2d")!;
      srcCtx.drawImage(imageRef.current, 0, 0);

      // Convert normalized corners to pixel coordinates on full-res image
      const pixelCorners: Point[] = corners.map((c) => ({
        x: c.x * imgSize.w,
        y: c.y * imgSize.h,
      }));

      // Calculate output dimensions based on the quad's real-world proportions
      const topWidth = Math.sqrt(
        (pixelCorners[1].x - pixelCorners[0].x) ** 2 +
        (pixelCorners[1].y - pixelCorners[0].y) ** 2
      );
      const bottomWidth = Math.sqrt(
        (pixelCorners[2].x - pixelCorners[3].x) ** 2 +
        (pixelCorners[2].y - pixelCorners[3].y) ** 2
      );
      const leftHeight = Math.sqrt(
        (pixelCorners[3].x - pixelCorners[0].x) ** 2 +
        (pixelCorners[3].y - pixelCorners[0].y) ** 2
      );
      const rightHeight = Math.sqrt(
        (pixelCorners[2].x - pixelCorners[1].x) ** 2 +
        (pixelCorners[2].y - pixelCorners[1].y) ** 2
      );

      const outW = Math.round(Math.max(topWidth, bottomWidth));
      const outH = Math.round(Math.max(leftHeight, rightHeight));

      // Apply perspective warp
      const resultCanvas = perspectiveWarp(srcCanvas, pixelCorners, outW, outH);

      // Convert cropped image to PDF for accountant-friendly format
      const imgDataUrl = resultCanvas.toDataURL("image/jpeg", 0.92);
      
      // Calculate PDF dimensions (72 DPI, max 8.5x11 inches)
      const maxWidthPt = 8.5 * 72; // 612pt
      const maxHeightPt = 11 * 72;  // 792pt
      const imgAspect = outW / outH;
      
      let pdfW: number, pdfH: number;
      if (imgAspect > maxWidthPt / maxHeightPt) {
        // Wider than page ratio — fit to width
        pdfW = maxWidthPt;
        pdfH = maxWidthPt / imgAspect;
      } else {
        // Taller — fit to height
        pdfH = maxHeightPt;
        pdfW = maxHeightPt * imgAspect;
      }
      
      const orientation = pdfW > pdfH ? "landscape" : "portrait";
      const doc = new jsPDF({
        orientation,
        unit: "pt",
        format: [pdfW, pdfH],
      });
      
      doc.addImage(imgDataUrl, "JPEG", 0, 0, pdfW, pdfH);
      const pdfBlob = doc.output("blob");
      
      const file = new File([pdfBlob], "scanned-receipt.pdf", {
        type: "application/pdf",
      });
      onCropped(file);
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setProcessing(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading image...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Detecting overlay */}
      {detecting && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30 animate-pulse">
          <ScanSearch className="h-5 w-5 text-primary flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium text-primary">Detecting receipt edges...</p>
        </div>
      )}

      {/* Instructions — shown after detection completes */}
      {!detecting && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          autoDetected
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-primary/5 border-primary/20"
        }`}>
          {autoDetected ? (
            <Sparkles className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          ) : (
            <Move className="h-5 w-5 text-primary flex-shrink-0" />
          )}
          <p className="text-sm">
            {autoDetected ? (
              <>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Edges detected automatically!</span>{" "}
                Adjust corners if needed, then tap <strong>Crop & Flatten</strong>.
              </>
            ) : (
              <>
                <span className="font-medium text-primary">Drag corners or edges</span>{" "}
                to align with the receipt, then tap <strong>Crop & Flatten</strong>.
              </>
            )}
          </p>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="relative flex justify-center">
        <div className="relative" style={{ width: displaySize.w, height: displaySize.h }}>
          <canvas
            ref={canvasRef}
            width={displaySize.w}
            height={displaySize.h}
            className="rounded-lg cursor-crosshair touch-none"
            style={{ width: displaySize.w, height: displaySize.h, maxWidth: "100%" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {/* Magnifier loupe — appears when dragging a corner */}
          {draggingIdx !== null && touchPos && (
            <canvas
              ref={magnifierCanvasRef}
              width={MAGNIFIER_SIZE}
              height={MAGNIFIER_SIZE}
              style={getMagnifierStyle()}
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-2"
          disabled={processing}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Corners
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoFit}
          className="gap-2"
          disabled={processing}
        >
          <Maximize2 className="h-4 w-4" />
          Fit to Edges
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={processing}
        >
          Skip
        </Button>
        <Button
          size="sm"
          onClick={handleCropAndFlatten}
          disabled={processing}
          className="gap-2 neon-glow-hover"
        >
          {processing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Crop & Flatten
        </Button>
      </div>
    </div>
  );
}
