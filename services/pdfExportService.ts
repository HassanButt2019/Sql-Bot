import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DashboardItem } from '../types';
import { ReportTemplate } from '../components/ReportTemplates';

interface PDFExportOptions {
  title: string;
  items: DashboardItem[];
  template: ReportTemplate;
  includeCoverPage?: boolean;
  companyName?: string;
  generatedBy?: string;
}

interface PDFColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  lightBg: string;
}

const getThemeColors = (theme: string): PDFColors => {
  switch (theme) {
    case 'professional':
      return { primary: '#1e40af', secondary: '#3b82f6', accent: '#60a5fa', text: '#1e293b', lightBg: '#f1f5f9' };
    case 'modern':
      return { primary: '#7c3aed', secondary: '#8b5cf6', accent: '#a78bfa', text: '#1e293b', lightBg: '#f5f3ff' };
    case 'corporate':
      return { primary: '#0f172a', secondary: '#334155', accent: '#64748b', text: '#0f172a', lightBg: '#f8fafc' };
    case 'vibrant':
      return { primary: '#0891b2', secondary: '#06b6d4', accent: '#22d3ee', text: '#164e63', lightBg: '#ecfeff' };
    default:
      return { primary: '#1e40af', secondary: '#3b82f6', accent: '#60a5fa', text: '#1e293b', lightBg: '#f1f5f9' };
  }
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const addCoverPage = (doc: jsPDF, title: string, template: ReportTemplate, itemCount: number, companyName?: string, generatedBy?: string) => {
  const colors = getThemeColors(template.colorTheme);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date();

  const primaryRgb = hexToRgb(colors.primary);
  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.rect(0, 0, pageWidth, pageHeight * 0.5, 'F');

  const accentRgb = hexToRgb(colors.accent);
  doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
  doc.rect(0, pageHeight * 0.5, pageWidth, 6, 'F');

  if (companyName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text(companyName.toUpperCase(), 40, 50);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(42);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(title, pageWidth - 80);
  let yPos = pageHeight * 0.25;
  titleLines.forEach((line: string) => { doc.text(line, 40, yPos); yPos += 20; });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(200, 220, 255);
  doc.text('Analytics Report', 40, yPos + 15);

  const detailsY = pageHeight * 0.58;
  const textRgb = hexToRgb(colors.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(130, 130, 130);
  doc.text('REPORT DETAILS', 40, detailsY);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(40, detailsY + 8, pageWidth - 40, detailsY + 8);

  const details = [
    { label: 'Generated', value: formatDate(now) + ' at ' + formatTime(now) },
    { label: 'Widgets', value: itemCount + ' analytics visualizations' },
    { label: 'Template', value: template.name },
    { label: 'Layout', value: template.pageOrientation + ', ' + template.columns + ' columns' }
  ];
  if (generatedBy) details.push({ label: 'Prepared By', value: generatedBy });

  let detailY = detailsY + 28;
  details.forEach(detail => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(detail.label, 40, detailY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textRgb.r, textRgb.g, textRgb.b);
    doc.text(detail.value, 120, detailY);
    detailY += 16;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text('Generated with SQL Mind - AI-Powered Business Intelligence', 40, pageHeight - 30);
};

const addPageHeader = (doc: jsPDF, title: string, template: ReportTemplate) => {
  const colors = getThemeColors(template.colorTheme);
  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryRgb = hexToRgb(colors.primary);

  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.rect(0, 0, pageWidth, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 15, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const dateStr = formatDate(new Date());
  const dateWidth = doc.getTextWidth(dateStr);
  doc.text(dateStr, pageWidth - dateWidth - 15, 12);
};

const addPageFooter = (doc: jsPDF, pageNum: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('SQL Mind Analytics Report', 15, pageHeight - 8);

  const pageText = 'Page ' + pageNum + ' of ' + totalPages;
  const pageTextWidth = doc.getTextWidth(pageText);
  doc.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 8);
};

const renderChartToCanvas = async (item: DashboardItem): Promise<HTMLCanvasElement | null> => {
  const chartElement = document.getElementById('chart-' + item.id);
  if (!chartElement) return null;

  try {
    const canvas = await html2canvas(chartElement, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    return canvas;
  } catch (error) {
    console.error('Error capturing chart:', error);
    return null;
  }
};

const addDataTable = (doc: jsPDF, item: DashboardItem, startY: number, pageWidth: number, colors: PDFColors): number => {
  if (item.chartData.length === 0) return startY;

  const margin = 15;
  const tableWidth = pageWidth - (margin * 2);
  const headers = Object.keys(item.chartData[0]);
  const colWidth = tableWidth / Math.min(headers.length, 6);
  let currentY = startY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('DATA TABLE', margin, currentY);
  currentY += 8;

  const primaryRgb = hexToRgb(colors.primary);
  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.rect(margin, currentY, tableWidth, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  const displayHeaders = headers.slice(0, 6);
  displayHeaders.forEach((header, i) => {
    const truncated = header.length > 14 ? header.substring(0, 12) + '..' : header;
    doc.text(truncated, margin + 4 + (i * colWidth), currentY + 7);
  });

  currentY += 10;
  const maxRows = Math.min(item.chartData.length, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
    const row = item.chartData[rowIdx];
    if (rowIdx % 2 === 0) {
      const lightRgb = hexToRgb(colors.lightBg);
      doc.setFillColor(lightRgb.r, lightRgb.g, lightRgb.b);
      doc.rect(margin, currentY, tableWidth, 8, 'F');
    }
    doc.setTextColor(60, 60, 60);
    displayHeaders.forEach((header, i) => {
      let value = String(row[header] ?? '');
      if (value.length > 16) value = value.substring(0, 14) + '..';
      doc.text(value, margin + 4 + (i * colWidth), currentY + 6);
    });
    currentY += 8;
  }

  return currentY + 8;
};

export const exportToPDF = async (options: PDFExportOptions): Promise<void> => {
  const { title, items, template, includeCoverPage = true, companyName, generatedBy } = options;

  const orientation = template.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colors = getThemeColors(template.colorTheme);
  
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  const headerHeight = 25;
  const footerHeight = 20;

  if (includeCoverPage) {
    addCoverPage(doc, title, template, items.length, companyName, generatedBy);
    doc.addPage();
  }

  addPageHeader(doc, title, template);

  let currentY = headerHeight + 5;

  if (template.includeSummary) {
    const primaryRgb = hexToRgb(colors.primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.text('Executive Summary', margin, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const summaryText = 'This report contains ' + items.length + ' analytics widgets generated on ' + formatDate(new Date()) + '. The visualizations below provide insights derived from your SQL queries and database analysis.';
    const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
    doc.text(summaryLines, margin, currentY);
    currentY += (summaryLines.length * 6) + 15;
  }

  const columns = template.columns;
  const chartGap = 10;
  const chartWidth = (contentWidth - (chartGap * (columns - 1))) / columns;
  
  let baseChartHeight: number;
  if (template.chartSize === 'large') baseChartHeight = orientation === 'landscape' ? 110 : 130;
  else if (template.chartSize === 'medium') baseChartHeight = orientation === 'landscape' ? 85 : 100;
  else baseChartHeight = orientation === 'landscape' ? 65 : 80;

  const chartHeight = columns === 1 ? Math.min(baseChartHeight * 1.4, pageHeight - headerHeight - footerHeight - 50) : baseChartHeight;

  let columnIndex = 0;
  let rowStartY = currentY;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const xPos = margin + (columnIndex * (chartWidth + chartGap));
    
    const estimatedHeight = chartHeight + 35;
    if (rowStartY + estimatedHeight > pageHeight - footerHeight) {
      doc.addPage();
      addPageHeader(doc, title, template);
      rowStartY = headerHeight + 5;
      columnIndex = 0;
    }

    // Shadow
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(xPos + 1, rowStartY + 1, chartWidth, chartHeight + 30, 4, 4, 'F');
    
    // Container
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(xPos, rowStartY, chartWidth, chartHeight + 30, 4, 4, 'F');

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.roundedRect(xPos, rowStartY, chartWidth, chartHeight + 30, 4, 4, 'S');

    // Top accent bar
    const primaryRgb = hexToRgb(colors.primary);
    doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.rect(xPos, rowStartY, chartWidth, 3, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    let titleText = item.title;
    if (titleText.length > 35) titleText = titleText.substring(0, 32) + '...';
    doc.text(titleText, xPos + 10, rowStartY + 16);

    // Chart type
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(item.chartConfig.type.toUpperCase() + ' CHART', xPos + 10, rowStartY + 24);

    // Capture chart
    const canvas = await renderChartToCanvas(item);
    if (canvas) {
      const imgData = canvas.toDataURL('image/png');
      const canvasAspect = canvas.width / canvas.height;
      const maxImgWidth = chartWidth - 16;
      const maxImgHeight = chartHeight - 10;
      
      let imgWidth = maxImgWidth;
      let imgHeight = imgWidth / canvasAspect;
      
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight * canvasAspect;
      }
      
      const imgX = xPos + 8 + (maxImgWidth - imgWidth) / 2;
      doc.addImage(imgData, 'PNG', imgX, rowStartY + 30, imgWidth, imgHeight);
    } else {
      const lightRgb = hexToRgb(colors.lightBg);
      doc.setFillColor(lightRgb.r, lightRgb.g, lightRgb.b);
      doc.roundedRect(xPos + 10, rowStartY + 30, chartWidth - 20, chartHeight - 15, 3, 3, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(160, 160, 160);
      doc.text('[Chart visualization]', xPos + chartWidth / 2 - 20, rowStartY + 30 + chartHeight / 2);
    }

    columnIndex++;
    if (columnIndex >= columns) {
      columnIndex = 0;
      rowStartY += chartHeight + 40;
      
      if (template.includeDataTables) {
        for (let j = i - columns + 1; j <= i; j++) {
          if (j >= 0 && items[j].chartData.length > 0) {
            if (rowStartY + 70 > pageHeight - footerHeight) {
              doc.addPage();
              addPageHeader(doc, title, template);
              rowStartY = headerHeight + 5;
            }
            rowStartY = addDataTable(doc, items[j], rowStartY, pageWidth, colors);
          }
        }
      }
    }
  }

  if (columnIndex > 0) rowStartY += chartHeight + 40;

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1 || !includeCoverPage) {
      addPageFooter(doc, includeCoverPage ? i : i + 1, totalPages);
    }
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(safeTitle + '_' + dateStr + '.pdf');
};

export const exportToImage = async (elementId: string, filename: string): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found for PNG export');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false
  });

  const link = document.createElement('a');
  const safeFilename = filename.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = safeFilename + '_' + dateStr + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};
