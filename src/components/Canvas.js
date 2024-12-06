import { Table } from './Table';
import { Relationship } from './Relationship';
import { GRID_SIZE } from '../utils/constants';
import { HistoryManager, createAddTableCommand, createAddRelationshipCommand } from '../utils/history';

export class Canvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tables = new Map();
        this.relationships = new Set();
        this.offset = { x: 0, y: 0 };
        this.scale = 1;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.history = new HistoryManager();
        
        this.resize();
        this.setupGrid();
        this.render();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    setupGrid() {
        const gridPattern = document.createElement('canvas');
        gridPattern.width = GRID_SIZE;
        gridPattern.height = GRID_SIZE;
        const patternCtx = gridPattern.getContext('2d');
        
        patternCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        patternCtx.beginPath();
        patternCtx.moveTo(0, 0);
        patternCtx.lineTo(GRID_SIZE, 0);
        patternCtx.lineTo(GRID_SIZE, GRID_SIZE);
        patternCtx.stroke();
        
        this.gridPattern = this.ctx.createPattern(gridPattern, 'repeat');
    }

    render() {
        this.ctx.save();
        
        // Clear canvas
        this.ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--canvas-bg');
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.ctx.fillStyle = this.gridPattern;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply transformations
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.scale, this.scale);
        
        // Draw relationships
        this.relationships.forEach(rel => rel.draw(this.ctx));
        
        // Draw tables
        this.tables.forEach(table => table.draw(this.ctx));
        
        this.ctx.restore();
    }

    addTable(name = 'New Table', x = 100, y = 100) {
        const table = new Table(name, x, y);
        const command = createAddTableCommand(this, table);
        this.history.execute(command);
        return table;
    }

    addRelationship(sourceTable, targetTable, type) {
        const relationship = new Relationship(sourceTable, targetTable, type);
        const command = createAddRelationshipCommand(this, relationship);
        this.history.execute(command);
        return relationship;
    }

    toJSON() {
        return {
            tables: Array.from(this.tables.values()).map(t => t.toJSON()),
            relationships: Array.from(this.relationships).map(r => r.toJSON())
        };
    }

    loadDiagram(data) {
        this.tables.clear();
        this.relationships.clear();
        
        data.tables.forEach(tableData => {
            const table = new Table(
                tableData.name,
                tableData.x,
                tableData.y,
                tableData.attributes
            );
            this.tables.set(table.id, table);
        });
        
        data.relationships.forEach(relData => {
            const sourceTable = this.tables.get(relData.sourceId);
            const targetTable = this.tables.get(relData.targetId);
            if (sourceTable && targetTable) {
                this.addRelationship(sourceTable, targetTable, relData.type);
            }
        });
        
        this.render();
    }

    exportAsImage(filename = 'erd-diagram.png') {
        // Create a temporary canvas with the current diagram
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Calculate the bounds of all tables
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        this.tables.forEach(table => {
            minX = Math.min(minX, table.x);
            minY = Math.min(minY, table.y);
            maxX = Math.max(maxX, table.x + table.width);
            maxY = Math.max(maxY, table.y + table.height);
        });
        
        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Set canvas size to fit the diagram
        tempCanvas.width = maxX - minX;
        tempCanvas.height = maxY - minY;
        
        // Fill background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Translate context to move diagram into view
        tempCtx.translate(-minX, -minY);
        
        // Draw relationships
        this.relationships.forEach(rel => rel.draw(tempCtx));
        
        // Draw tables
        this.tables.forEach(table => table.draw(tempCtx));
        
        // Create download link
        const link = document.createElement('a');
        link.download = filename;
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }
}
