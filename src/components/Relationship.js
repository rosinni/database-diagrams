export class Relationship {
    constructor(sourceTable, targetTable, type = "oneToMany", canvas = null) {
        this.sourceTable = sourceTable;
        this.targetTable = targetTable;
        this.type = type;
        this.canvas = canvas || sourceTable?.canvas || targetTable?.canvas;
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
        
        // Get all existing relationships, or empty array if canvas not available
        const relationships = this.canvas ? Array.from(this.canvas.relationships) : [];
        
        // Track used incoming points for each table with their relationships
        const usedIncomingPoints = new Map();
        
        // First pass: collect all current connection points usage
        relationships.forEach(rel => {
            if (rel !== this) {
                const targetId = rel.targetTable.id;
                if (!usedIncomingPoints.has(targetId)) {
                    usedIncomingPoints.set(targetId, new Map());
                }
                
                const tablePoints = rel.targetTable.getConnectionPoints();
                
                // Find the nearest point currently being used by this relationship
                let nearestPoint = null;
                let minDist = Infinity;
                
                tablePoints.forEach(point => {
                    const dist = Math.hypot(
                        point.x - (rel.sourceTable.x + rel.sourceTable.width/2),
                        point.y - (rel.sourceTable.y + rel.sourceTable.height/2)
                    );
                    if (dist < minDist) {
                        minDist = dist;
                        nearestPoint = point;
                    }
                });
                
                if (nearestPoint) {
                    const pointKey = `${nearestPoint.x},${nearestPoint.y}`;
                    const relationshipsAtPoint = usedIncomingPoints.get(targetId).get(pointKey) || [];
                    relationshipsAtPoint.push(rel);
                    usedIncomingPoints.get(targetId).set(pointKey, relationshipsAtPoint);
                }
            }
        });

        // For the current relationship's target table
        const targetId = this.targetTable.id;
        const currentTablePoints = usedIncomingPoints.get(targetId) || new Map();
        
        // Find the best connection point considering angle and usage
        sourcePoints.forEach((sp) => {
            targetPoints.forEach((tp) => {
                const pointKey = `${tp.x},${tp.y}`;
                const relationshipsAtPoint = currentTablePoints.get(pointKey) || [];
                const distance = Math.hypot(tp.x - sp.x, tp.y - sp.y);
                
                // Calculate angle score (prefer points that maintain better angles)
                const angle = Math.atan2(tp.y - sp.y, tp.x - sp.x);
                const angleScore = Math.abs(angle % (Math.PI / 2)); // Prefer horizontal/vertical connections
                
                // Weighted score combining distance and angle
                const usagePenalty = relationshipsAtPoint.length * 100; // Heavy penalty for used points
                const totalScore = distance + angleScore * 50 + usagePenalty;
                
                if (totalScore < minDistance) {
                    minDistance = totalScore;
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
