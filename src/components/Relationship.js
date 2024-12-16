export class Relationship {
    constructor(sourceTable, targetTable, type = "oneToMany") {
        this.sourceTable = sourceTable;
        this.targetTable = targetTable;
        this.type = type;
        this.canvas = null; // Will be set by Canvas class after creation
    }

    draw(ctx) {
        const source = this.getNearestPoints(
            this.sourceTable.getConnectionPoints(),
            this.targetTable.getConnectionPoints(),
        );

        ctx.beginPath();
        ctx.moveTo(source.start.x, source.start.y);
        ctx.lineTo(source.end.x, source.end.y);
        ctx.strokeStyle = "var(--bs-primary)";
        ctx.lineWidth = 2;
        ctx.stroke();

        this.drawCrowFoot(ctx, source);
    }

    drawCrowFoot(ctx, points) {
        const angle = Math.atan2(
            points.end.y - points.start.y,
            points.end.x - points.start.x,
        );

        ctx.beginPath();

        switch (this.type) {
            case "oneToMany":
                this.drawOneToMany(ctx, points.end, angle);
                break;
            case "oneToOne":
                this.drawOneToOne(ctx, points.end, angle);
                break;
            case "manyToMany":
                this.drawManyToMany(ctx, points.end, angle);
                break;
        }

        ctx.stroke();
    }

    drawOneToOne(ctx, point, angle) {
        const length = 15;
        ctx.moveTo(
            point.x - length * Math.cos(angle),
            point.y - length * Math.sin(angle),
        );
        ctx.lineTo(point.x, point.y);

        // Draw the vertical line
        const verticalOffset = 8;
        const x = point.x - (length - 5) * Math.cos(angle);
        const y = point.y - (length - 5) * Math.sin(angle);
        ctx.moveTo(
            x + verticalOffset * Math.sin(angle),
            y - verticalOffset * Math.cos(angle),
        );
        ctx.lineTo(
            x - verticalOffset * Math.sin(angle),
            y + verticalOffset * Math.cos(angle),
        );
    }

    drawOneToMany(ctx, point, angle) {
        const length = 15;
        const spread = Math.PI / 6; // 30 degrees spread

        // Draw the base line
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(
            point.x - length * Math.cos(angle),
            point.y - length * Math.sin(angle),
        );

        // Draw the upper line of the crow's foot
        ctx.moveTo(point.x - length * Math.cos(angle - spread), point.y);
        ctx.lineTo(point.x, point.y - length * Math.sin(angle - spread));

        // Draw the lower line of the crow's foot
        ctx.moveTo(point.x - length * Math.cos(angle + spread), point.y);
        ctx.lineTo(point.x, point.y - length * Math.sin(angle + spread));
    }

    drawManyToMany(ctx, point, angle) {
        this.drawOneToMany(ctx, point, angle);

        // Add second crow's foot
        const length = 15;
        const spread = Math.PI / 6;
        const offset = 10;
        const x = point.x - offset * Math.cos(angle);
        const y = point.y - offset * Math.sin(angle);

        ctx.moveTo(
            x - length * Math.cos(angle - spread),
            y - length * Math.sin(angle - spread),
        );
        ctx.lineTo(x, y);
        ctx.lineTo(
            x - length * Math.cos(angle + spread),
            y - length * Math.sin(angle + spread),
        );
    }

    getNearestPoints(sourcePoints, targetPoints) {
        let minDistance = Infinity;
        let result = { start: null, end: null };

        // Get all existing relationships
        const relationships = Array.from(this.sourceTable.canvas.relationships);
        
        // Filter out used connection points
        const usedSourcePoints = relationships
            .filter(rel => rel !== this && (rel.sourceTable === this.sourceTable || rel.targetTable === this.sourceTable))
            .map(rel => {
                const points = rel.getNearestPoints(
                    rel.sourceTable.getConnectionPoints(),
                    rel.targetTable.getConnectionPoints()
                );
                return rel.sourceTable === this.sourceTable ? points.start : points.end;
            });

        const usedTargetPoints = relationships
            .filter(rel => rel !== this && (rel.sourceTable === this.targetTable || rel.targetTable === this.targetTable))
            .map(rel => {
                const points = rel.getNearestPoints(
                    rel.sourceTable.getConnectionPoints(),
                    rel.targetTable.getConnectionPoints()
                );
                return rel.sourceTable === this.targetTable ? points.start : points.end;
            });

        // Filter out used points
        const availableSourcePoints = sourcePoints.filter(sp => 
            !usedSourcePoints.some(up => 
                Math.abs(up.x - sp.x) < 1 && Math.abs(up.y - sp.y) < 1
            )
        );

        const availableTargetPoints = targetPoints.filter(tp => 
            !usedTargetPoints.some(up => 
                Math.abs(up.x - tp.x) < 1 && Math.abs(up.y - tp.y) < 1
            )
        );

        // If all points are used, fall back to original points
        const finalSourcePoints = availableSourcePoints.length > 0 ? availableSourcePoints : sourcePoints;
        const finalTargetPoints = availableTargetPoints.length > 0 ? availableTargetPoints : targetPoints;

        finalSourcePoints.forEach((sp) => {
            finalTargetPoints.forEach((tp) => {
                const distance = Math.hypot(tp.x - sp.x, tp.y - sp.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    result = { start: sp, end: tp };
                }
            });
        });

        return result;
    }

    containsPoint(x, y) {
        // Get the actual connection points being used
        const points = this.getNearestPoints(
            this.sourceTable.getConnectionPoints(),
            this.targetTable.getConnectionPoints()
        );
        
        // Calculate distance from point to line segment
        const distanceToSegment = this.pointToLineDistance(
            x, y,
            points.start.x, points.start.y,
            points.end.x, points.end.y
        );
        
        // Return true if point is within 5 pixels of the line
        return distanceToSegment < 5;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;

        return Math.sqrt(dx * dx + dy * dy);
    }

    toJSON() {
        return {
            sourceId: this.sourceTable.id,
            targetId: this.targetTable.id,
            type: this.type,
        };
    }
}
