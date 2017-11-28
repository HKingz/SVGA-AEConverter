/// <reference path="../app/svga.ts" />
/**
 * Author: Pony Cui
 * Date: 2016.08.01
 * Dev: TypeScript 1.8
 * Env: After Effects CC 2015
 * Build: npm install & npm start
 */

class Converter {

    app: AE.App = undefined;
    proj: SVGA.Project = undefined;
    res: SVGA.Resource[] = [];
    layers: SVGA.Layer[] = [];
    trimmingCache: any = {};

    constructor(app: AE.App) {
        this.app = app;
        this.loadProj();
        this.loadRes(app.project.activeItem.layers, app.project.activeItem.layers.length);
        this.loadLayer({frameRate: app.project.activeItem.frameRate, duration: app.project.activeItem.duration}, app.project.activeItem.layers, app.project.activeItem.layers.length, undefined, undefined, []);
        this.mergeLayers();
    }

    loadProj() {
        this.proj = {
            name: this.app.project.activeItem.name,
            width: this.app.project.activeItem.width,
            height: this.app.project.activeItem.height,
            frameRate: this.app.project.activeItem.frameRate,
            frameCount: this.app.project.activeItem.frameRate * this.app.project.activeItem.duration,
        }
    }

    loadRes(layers: AE.AVLayer[], numLayers: number) {
        var m = {};
        for (var i = 1; i <= layers.length; i++) {
            var element = layers[i];
            if (element.enabled === false || element.source === null || element.source === undefined) {
                continue;
            }
            if (element.source instanceof Object && element.source.file) {
                if (m[element.source.id] === true) {
                    continue;
                }
                m[element.source.id] = true;
                if ((element.source.file as any).fsName.indexOf(".psd") > 0 || (element.source.file as any).fsName.indexOf(".psb") > 0) {
                    this.res.push({
                        name: "psd_" + element.source.id + ".png",
                        path: (element.source.file as any).fsName,
                        source: element.source,
                        psdID: element.source.id.toString(),
                    })
                }
                else {
                    var eName: string = element.source.name;
                    if (element.source.name.match(/[^a-zA-Z0-9\.\_\-]/)) {
                        eName = "img_" + element.source.id + ".png";
                    }
                    else {
                        eName = element.source.name;
                    }
                    this.res.push({
                        name: eName,
                        path: (element.source.file as any).fsName,
                        source: element.source,
                        psdID: undefined,
                    })
                }
            }
            else if (element.source instanceof Object && element.source.numLayers > 0) {
                this.loadRes(element.source.layers, element.source.numLayers);
            }
        }
    }

    loadLayer(frameConfig: {frameRate: number, duration: number}, layers: AE.AVLayer[], numLayers: number, parentValues: any, startTime: number, parents: AE.AVLayer[]) {
        for (var i = 1; i <= numLayers; i++) {
            var element = layers[i];
            if (element.enabled === false) {
                continue;
            }
            if (element.matchName === "ADBE Vector Layer") {
                if (parentValues) {
                    this.layers.push({
                        name: element.name + ".vector",
                        values: this.concatValues(parentValues, {
                                alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                                layout: this.requestLayout(frameConfig, element.width, element.height),
                                matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                                mask: this.requestMask(frameConfig, element, parents),
                                shapes: this.requestShapes(frameConfig, element),
                        }, element.width, element.height, startTime),
                    });
                }
                else {
                    this.layers.push({
                        name: element.name + ".vector",
                        values: {
                                alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                                layout: this.requestLayout(frameConfig, element.width, element.height),
                                matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                                mask: this.requestMask(frameConfig, element, parents),
                                shapes: this.requestShapes(frameConfig, element),
                        }
                    });
                }
            }
            else if (element.source instanceof Object && element.source.file) {
                var eName: string = element.source.name;
                if (eName.indexOf('.psd') > 0 || eName.indexOf('.psb') > 0) {
                    eName = "psd_" + element.source.id + ".png";
                }
                else {
                    if (element.source.name.match(/[^a-zA-Z0-9\.\_\-]/)) {
                        eName = "img_" + element.source.id + ".png";
                    }
                    else {
                        eName = element.source.name;
                    }
                }
                if (parentValues) {
                    this.layers.push({
                        name: eName,
                        values: this.concatValues(parentValues, {
                            alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                            layout: this.requestLayout(frameConfig, element.width, element.height),
                            matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                            mask: this.requestMask(frameConfig, element, parents),
                            shapes: [],
                        }, element.width, element.height, startTime),
                    });
                }
                else {
                    this.layers.push({
                        name: eName,
                        values: {
                            alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                            layout: this.requestLayout(frameConfig, element.width, element.height),
                            matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                            mask: this.requestMask(frameConfig, element, parents),
                            shapes: [],
                        }
                    });
                }
            }
            else if (element.source instanceof Object && element.source.numLayers > 0) {
                var nextParents = [];
                if (parents !== undefined) {
                    for (var index = 0; index < parents.length; index++) {
                        nextParents.push(parents[index]);
                    }
                }
                nextParents.push(element);
                if (parentValues) {
                    this.loadLayer({frameRate: (element.source as any).frameRate, duration: (element.source as any).duration}, element.source.layers, element.source.numLayers, this.concatValues(parentValues, {
                        alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                        layout: this.requestLayout(frameConfig, element.width, element.height),
                        matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                        mask: [],
                        shapes: [],
                    }, element.width, element.height, startTime), element.startTime, nextParents);
                }
                else {
                    this.loadLayer({frameRate: (element.source as any).frameRate, duration: (element.source as any).duration}, element.source.layers, element.source.numLayers, {
                        alpha: this.requestAlpha(frameConfig, element.transform.opacity, element.inPoint, element.outPoint),
                        layout: this.requestLayout(frameConfig, element.width, element.height),
                        matrix: this.requestMatrix(frameConfig, element.transform, element.width, element.height, element),
                        mask: [],
                        shapes: [],
                    }, element.startTime, nextParents);
                }
            }
        }
    }

    concatValues(a: any, b: any, width: number, height: number, startTime: number): any {
        let c: any = JSON.parse(JSON.stringify(a));
        let startIndex = Math.floor(startTime / (1.0 / Math.round(this.proj.frameRate)));
        for (let aIndex = startIndex, bIndex = 0; bIndex < b.alpha.length; aIndex++ , bIndex++) {
            if (aIndex < 0) {
                continue;
            }
            c.alpha[aIndex] = b.alpha[bIndex] * a.alpha[aIndex];
        }
        for (let aIndex = startIndex + b.alpha.length; aIndex < a.alpha.length; aIndex++) {
            if (aIndex < 0) {
                continue;
            }
            delete c.alpha[aIndex];
        }
        for (let aIndex = startIndex, bIndex = 0; bIndex < b.layout.length; aIndex++ , bIndex++) {
            if (aIndex < 0) {
                continue;
            }
            c.layout[aIndex] = b.layout[bIndex];
        }
        for (let aIndex = startIndex + b.layout.length; aIndex < a.layout.length; aIndex++) {
            if (aIndex < 0) {
                continue;
            }
            delete c.layout[aIndex];
        }
        for (let aIndex = startIndex, bIndex = 0; bIndex < b.mask.length; aIndex++ , bIndex++) {
            if (aIndex < 0) {
                continue;
            }
            c.mask[aIndex] = b.mask[bIndex];
        }
        for (let aIndex = startIndex + b.mask.length; aIndex < a.mask.length; aIndex++) {
            if (aIndex < 0) {
                continue;
            }
            delete c.mask[aIndex];
        }
        for (let aIndex = startIndex, bIndex = 0; bIndex < b.matrix.length && aIndex < a.matrix.length; aIndex++ , bIndex++) {
            if (aIndex < 0) {
                continue;
            }
            let matrix = new Matrix();
            matrix.reset();
            if (b.matrix[bIndex] !== undefined && b.matrix[bIndex] !== null) {
                matrix.transform(b.matrix[bIndex].a, b.matrix[bIndex].b, 0, 0, b.matrix[bIndex].c, b.matrix[bIndex].d, 0, 0, 0, 0, 0, 0, b.matrix[bIndex].tx, b.matrix[bIndex].ty, 0, 0);
                c.matrix[aIndex] = {
                    a: matrix.props[0],
                    b: matrix.props[1],
                    c: matrix.props[4],
                    d: matrix.props[5],
                    tx: matrix.props[12],
                    ty: matrix.props[13],
                };
            }
            if (a.matrix[aIndex] !== undefined && a.matrix[aIndex] !== null) {
                matrix.transform(a.matrix[aIndex].a, a.matrix[aIndex].b, 0, 0, a.matrix[aIndex].c, a.matrix[aIndex].d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
                c.matrix[aIndex] = {
                    a: matrix.props[0],
                    b: matrix.props[1],
                    c: matrix.props[4],
                    d: matrix.props[5],
                    tx: matrix.props[12] + a.matrix[aIndex].tx,
                    ty: matrix.props[13] + a.matrix[aIndex].ty,
                };
            }
        }
        for (let aIndex = startIndex + b.matrix.length; aIndex < a.matrix.length; aIndex++) {
            if (aIndex < 0) {
                continue;
            }
            delete c.matrix[aIndex];
        }
        for (let aIndex = startIndex, bIndex = 0; bIndex < b.shapes.length; aIndex++ , bIndex++) {
            if (aIndex < 0) {
                continue;
            }
            if (c.shapes != undefined && b.shapes != undefined) {
                c.shapes[aIndex] = b.shapes[bIndex];
            }
        }
        for (let aIndex = startIndex + b.shapes.length; aIndex < a.shapes.length; aIndex++) {
            if (aIndex < 0) {
                continue;
            }
            delete c.shapes[aIndex];
        }
        for (let index = 0; index < startIndex; index++) {
            delete c.alpha[index];
            delete c.layout[index];
            delete c.matrix[index];
            delete c.mask[index];
            if (c.shapes != undefined) {
                delete c.shapes[index];
            }
        }
        return c;
    }

    requestAlpha(frameConfig: {frameRate: number, duration: number}, prop: AE.KeyframeValues, inPoint: number, outPoint: number): any[] {
        let value: any[] = [];
        let step = 1.0 / this.proj.frameRate;
        for (var cTime = 0.0; cTime < frameConfig.duration; cTime += step) {
            if (inPoint > outPoint) {
                if (cTime > inPoint || cTime < outPoint) {
                    value.push(0.0);
                    continue;
                }
            }
            else if (inPoint < outPoint) {
                if (cTime < inPoint || cTime > outPoint) {
                    value.push(0.0);
                    continue;
                }
            }
            value.push(prop.valueAtTime(cTime, false) / 100.0);
        }
        return value;
    }

    requestMatrix(frameConfig: {frameRate: number, duration: number}, transform: AE.Transform, width: number, height: number, object: AE.AVLayer): SVGA.Matrix2D[] {
        let value: SVGA.Matrix2D[] = [];
        let step = 1.0 / this.proj.frameRate;
        for (var cTime = 0.0; cTime < frameConfig.duration; cTime += step) {
            let rotation = transform["Rotation"].valueAtTime(cTime, false);
            let ax = transform["Anchor Point"].valueAtTime(cTime, false)[0];
            let ay = transform["Anchor Point"].valueAtTime(cTime, false)[1];
            let sx = transform["Scale"].valueAtTime(cTime, false)[0] / 100.0;
            let sy = transform["Scale"].valueAtTime(cTime, false)[1] / 100.0;
            let tx = transform["Position"].valueAtTime(cTime, false)[0];
            let ty = transform["Position"].valueAtTime(cTime, false)[1];
            let matrix = new Matrix();
            matrix.translate(-ax, -ay).scale(sx, sy).rotate(-rotation * Math.PI / 180);
            matrix.translate(tx, ty);
            let currentParent = object.parent;
            while (currentParent != null && currentParent != undefined) {
                matrix.translate(-currentParent.transform["Anchor Point"].valueAtTime(cTime, false)[0], -currentParent.transform["Anchor Point"].valueAtTime(cTime, false)[1])
                        .scale(currentParent.transform["Scale"].valueAtTime(cTime, false)[0] / 100.0, currentParent.transform["Scale"].valueAtTime(cTime, false)[1] / 100.0)
                        .rotate(-(currentParent.transform["Rotation"].valueAtTime(cTime, false)) * Math.PI / 180);
                matrix.translate(currentParent.transform["Position"].valueAtTime(cTime, false)[0], currentParent.transform["Position"].valueAtTime(cTime, false)[1]);
                currentParent = currentParent.parent;
            }
            value.push({
                a: matrix.props[0],
                b: matrix.props[1],
                c: matrix.props[4],
                d: matrix.props[5],
                tx: matrix.props[12],
                ty: matrix.props[13],
            });
        }
        return value;
    }

    requestLayout(frameConfig: {frameRate: number, duration: number}, width: number, height: number): SVGA.Rect2D[] {
        let value: SVGA.Rect2D[] = [];
        let step = 1.0 / this.proj.frameRate;
        for (var cTime = 0.0; cTime < frameConfig.duration; cTime += step) {
            value.push({ x: 0, y: 0, width: width, height: height });
        }
        return value;
    }

    requestMask(frameConfig: {frameRate: number, duration: number}, layer: AE.AVLayer, parents: AE.AVLayer[]): string[] {
        let hasMask = false
        let masks: string[] = []
        let step = 1.0 / this.proj.frameRate;
        for (var cTime = 0.0; cTime < frameConfig.duration; cTime += step) {
            let d = ""
            if (layer.mask.numProperties > 0) {
                let maskElement: AE.MaskElement = (layer.mask as any)(1);
                d += this.requestPath(maskElement.property('maskShape').valueAtTime(cTime, false), {x: 0.0, y: 0.0});
                hasMask = true
            }
            let offsetX = layer.transform["Position"].valueAtTime(cTime, false)[0] - layer.transform["Anchor Point"].valueAtTime(cTime, false)[0];
            let offsetY = layer.transform["Position"].valueAtTime(cTime, false)[1] - layer.transform["Anchor Point"].valueAtTime(cTime, false)[1];
            for (let index = parents.length - 1; index >= 0; index--) {
                let element = parents[index];
                if (element.mask.numProperties > 0) {
                    let maskElement: AE.MaskElement = (element.mask as any)(1);
                    d += this.requestPath(maskElement.property('maskShape').valueAtTime(cTime, false), {x: -offsetX, y: -offsetY});
                    offsetX += element.transform["Position"].valueAtTime(cTime, false)[0] - element.transform["Anchor Point"].valueAtTime(cTime, false)[0];
                    offsetY += element.transform["Position"].valueAtTime(cTime, false)[1] - element.transform["Anchor Point"].valueAtTime(cTime, false)[1];
                    hasMask = true
                }
            }
            masks.push(d);
        }
        if (!hasMask) {
            return [];
        }
        return masks;
    }

    trimmedPath(path: any, reverse: Boolean = false, trim: {start: number, end: number}): string {
        let inTangents = path.inTangents as number[][]
        let outTangents = path.outTangents as number[][]
        let vertices = path.vertices as number[][]
        if (reverse) {
            inTangents = inTangents.reverse()
            outTangents = outTangents.reverse()
            vertices = vertices.reverse()
        }
        let cacheKey = inTangents.map(function(item){ return item[0] + "," + item[1] }).join(",") + "_" + 
                       outTangents.map(function(item){ return item[0] + "," + item[1] }).join(",") + "_" + 
                       vertices.map(function(item){ return item[0] + "," + item[1] }).join(",") + "_" + 
                       (reverse ? "true" : "false") + "_" + 
                       trim.start + "," + trim.end;
        if (this.trimmingCache[cacheKey] != undefined) {
            return this.trimmingCache[cacheKey];
        }
        let length = 0.0
        for (let index = 0; index <= vertices.length; index++) {
            let vertex: number[] = vertices[index];
            let it = inTangents[index];
            let ot = outTangents[index];
            if (index == 0) { }
            else if (index == vertices.length) {
                if (!path.closed) {
                    continue;
                }
                let curve = new Bezier(
                    vertices[index - 1][0] + outTangents[index - 1][0], 
                    vertices[index - 1][1] + outTangents[index - 1][1], 
                    vertices[0][0] + inTangents[0][0], 
                    vertices[0][1] + inTangents[0][1], 
                    vertices[0][0], 
                    vertices[0][1])
                length += curve.length()
            }
            else {
                let curve = new Bezier(
                    (vertices[index - 1][0] + outTangents[index - 1][0]),
                    (vertices[index - 1][1] + outTangents[index - 1][1]),
                    (vertex[0] + inTangents[index][0]),
                    (vertex[1] + inTangents[index][1]),
                    (vertex[0]),
                    (vertex[1]));
                length += curve.length()
            }
        }
        let curvePoints: number[][] = []
        let currentProgress = 0.0
        for (let index = 0; index <= vertices.length; index++) {
            let vertex: number[] = vertices[index];
            let it = inTangents[index];
            let ot = outTangents[index];
            if (index == 0) { }
            else if (index == vertices.length) {
                if (!path.closed) {
                    continue;
                }
                let curve = new Bezier(
                    vertices[index - 1][0] + outTangents[index - 1][0], 
                    vertices[index - 1][1] + outTangents[index - 1][1], 
                    vertices[0][0] + inTangents[0][0], 
                    vertices[0][1] + inTangents[0][1], 
                    vertices[0][0], 
                    vertices[0][1])
                let segmentProgress = curve.length() / length
                if (currentProgress >= trim.start && currentProgress + segmentProgress <= trim.end) {
                    curvePoints.push([vertex[0], vertex[1], vertices[index - 1][0] + outTangents[index - 1][0], vertices[index - 1][1] + outTangents[index - 1][1], vertex[0] + inTangents[index][0], vertex[1] + inTangents[index][1]])
                }
                else {
                    let trimmedLength = (trim.end > (currentProgress + segmentProgress) ? (currentProgress + segmentProgress) : trim.end) * length - (trim.start > currentProgress ? trim.start : currentProgress) * length
                    let trimmedLeftLength = Math.max(0.0, (trim.start - currentProgress) * length)
                    let trimmedRightLength = Math.max(0.0, ((currentProgress + segmentProgress) - trim.end) * length)
                    let t = {
                        s: trimmedLeftLength / curve.length(),
                        e: 1.0 - trimmedRightLength / curve.length()
                    }
                    let nc = curve.split(t.s, t.e)
                    curvePoints.push([nc.points[0].x, nc.points[0].y, nc.points[1].x, nc.points[1].y, nc.points[2].x, nc.points[2].y])
                }
                currentProgress += segmentProgress
            }
            else {
                let curve = new Bezier(
                    (vertices[index - 1][0] + outTangents[index - 1][0]),
                    (vertices[index - 1][1] + outTangents[index - 1][1]),
                    (vertex[0] + inTangents[index][0]),
                    (vertex[1] + inTangents[index][1]),
                    (vertex[0]),
                    (vertex[1]));
                let curveLength = curve.length()
                let segmentProgress = curveLength / length
                if (currentProgress >= trim.start && currentProgress + segmentProgress <= trim.end) {
                    curvePoints.push([vertices[index - 1][0] + outTangents[index - 1][0], vertices[index - 1][1] + outTangents[index - 1][1], vertex[0] + inTangents[index][0], vertex[1] + inTangents[index][1], vertex[0], vertex[1]])
                }
                else {
                    let trimmedLeftLength = Math.max(0.0, (trim.start - currentProgress) * length)
                    let trimmedRightLength = Math.max(0.0, ((currentProgress + segmentProgress) - trim.end) * length)
                    let t = {
                        s: trimmedLeftLength / curveLength,
                        e: 1.0 - trimmedRightLength / curveLength
                    }
                    let nc = curve.split(t.s, t.e)
                    curvePoints.push([nc.points[0].x, nc.points[0].y, nc.points[1].x, nc.points[1].y, nc.points[2].x, nc.points[2].y])
                }
                currentProgress += segmentProgress
            }
        }
        let d = "";
        for (let index = 0; index < curvePoints.length; index++) {
            var element = curvePoints[index];
            if (index == 0) {
                d += "M " + (element[0]) + " " + (element[1]);
            }
            d += " C " + (element[0]) + " " + (element[1]) + " " + (element[2]) + " " + (element[3]) + " " + (element[4]) + " " + (element[5]);
        }
        d = d.replace(/([0-9]+\.[0-9][0-9][0-9])[0-9]+/ig, "$1")
        this.trimmingCache[cacheKey] = d
        return d
    }

    requestPath(path: any, offset: {x: number, y: number}, reverse: Boolean = false, trim: {start: number, end: number} = {start: 0.0, end: 1.0}): string {
        let inTangents = path.inTangents as number[][]
        let outTangents = path.outTangents as number[][]
        let vertices = path.vertices as number[][]
        if (Math.abs(trim.end - trim.start) < 0.001 || trim.end < trim.start) {
            return ""
        }
        else if (trim.start > 0.0 || trim.end < 1.0) {
            return this.trimmedPath(path, reverse, trim)
        }
        for (let index = 0; index < vertices.length; index++) {
            let element = vertices[index];
            element[0] += offset.x
            element[1] += offset.y
            vertices[index] = element
        }
        let d = ""
        for (let index = 0; index <= vertices.length; index++) {
            let vertex: number[] = vertices[index];
            let it = inTangents[index];
            let ot = outTangents[index];
            if (index == 0) {
                d += "M" + vertex[0] + " " + vertex[1] + " ";
            }
            else if (index == vertices.length) {
                if (!path.closed) {
                    continue;
                }
                d += "C" + (vertices[index - 1][0] + outTangents[index - 1][0]) +
                        " " + (vertices[index - 1][1] + outTangents[index - 1][1]) + 
                        " " + (vertices[0][0] + inTangents[0][0]) + 
                        " " + (vertices[0][1] + inTangents[0][1]) + 
                        " " + (vertices[0][0]) + 
                        " " + (vertices[0][1]) + 
                        " ";
            }
            else {
                d += "C" + (vertices[index - 1][0] + outTangents[index - 1][0]) + 
                        " " + (vertices[index - 1][1] + outTangents[index - 1][1]) + 
                        " " + (vertex[0] + inTangents[index][0]) + 
                        " " + (vertex[1] + inTangents[index][1]) + 
                        " " + (vertex[0]) + 
                        " " + (vertex[1]) + 
                        " ";
            }
        }
        if (path.closed) {
            d += "Z";
        }
        d = d.replace(/([0-9]+\.[0-9][0-9][0-9])[0-9]+/ig, "$1")
        return d
    }

    requestShapes(frameConfig: {frameRate: number, duration: number}, layer: AE.AVLayer): SVGA.Shape2D[][] {
        let values: SVGA.Shape2D[][] = []
        let step = 1.0 / this.proj.frameRate;
        for (var cTime = 0.0; cTime < frameConfig.duration; cTime += step) {
            let value = this.requestShapesAtTime(layer, cTime)
            values.push(value);
        }
        return values;
    }

    requestShapesAtTime(layer: AE.AVLayer, cTime: number, parent?: AE.AVLayer): SVGA.Shape2D[] {
        var shapes: SVGA.Shape2D[] = []
        if (!layer.enabled) {
            return shapes;
        }
        if (layer.matchName == "ADBE Vector Shape - Group") {
            let pathContents = layer.property('Path');
            let path = pathContents.valueAtTime(cTime, false);
            let style = this.requestShapeStyles(layer, parent, cTime)
            let trim = {start: 0.0, end: 1.0}
            if (style.trim != null) {
                trim = style.trim
            }
            let d = this.requestPath(path, {x: 0.0, y: 0.0}, layer.property("Shape Direction").valueAtTime(cTime, false) === 3, trim)
            let shape: SVGA.Shape2D = {
                type: "shape",
                args: {
                    d: d,
                },
                styles: this.requestShapeStyles(layer, parent, cTime),
                transform: this.requestShapeTransform(parent, cTime),
            }
            delete shape.styles["trim"];
            shapes.unshift(shape);
        }
        else if (layer.matchName == "ADBE Vector Shape - Ellipse") {
            let sizeContents = layer.property('Size');
            let size = sizeContents.valueAtTime(cTime, false);
            let positionContents = layer.property('Position');
            let position = positionContents.valueAtTime(cTime, false);
            let shape: SVGA.Shape2D = {
                type: "ellipse",
                args: {
                    x: position[0],
                    y: position[1],
                    radiusX: size[0] / 2.0,
                    radiusY: size[1] / 2.0,
                },
                styles: this.requestShapeStyles(layer, parent, cTime),
                transform: this.requestShapeTransform(parent, cTime),
            }
            shapes.unshift(shape);
        }
        else if (layer.matchName == "ADBE Vector Shape - Rect") {
            let sizeContents = layer.property('Size');
            let size = sizeContents.valueAtTime(cTime, false);
            let positionContents = layer.property('Position');
            let position = positionContents.valueAtTime(cTime, false);
            let shape: SVGA.Shape2D = {
                type: "rect",
                args: {
                    x: position[0] - size[0] / 2.0,
                    y: position[1] - size[1] / 2.0,
                    width: size[0],
                    height: size[1],
                    cornerRadius: Math.min(Math.min(size[0] / 2.0, layer.property('Roundness').valueAtTime(cTime, false)), Math.min(size[1] / 2.0, layer.property('Roundness').valueAtTime(cTime, false))),
                },
                styles: this.requestShapeStyles(layer, parent, cTime),
                transform: this.requestShapeTransform(parent, cTime),
            }
            shapes.unshift(shape);
        }
        else {
            let contents = layer.property('Contents');
            if (contents != null && contents != undefined) {
                let numProperties: number = contents.numProperties;
                for (let index = 0; index < numProperties; index += 1) {
                    let sublayer: AE.AVLayer = contents.property(index + 1);
                    let results = this.requestShapesAtTime(sublayer, cTime, layer);
                    for (var i = 0; i < results.length; i++) {
                        var element = results[i];
                        shapes.unshift(element);
                    }
                }
            }
        }
        return shapes;
    }

    requestShapeStyles(layer: AE.AVLayer, parent: AE.AVLayer, cTime: number): any {
        let styles: any = {}
        let contents = parent.property('Contents');
        let numProperties: number = contents.numProperties;
        for (let index = numProperties - 1; index >= 0; index -= 1) {
            let sublayer: AE.AVLayer = contents.property(index + 1)
            if (!sublayer.enabled) {
                continue;
            }
            if (sublayer.matchName == "ADBE Vector Graphic - Fill") {
                styles.fill = sublayer.property('Color').valueAtTime(cTime, false)
            }
            else if (sublayer.matchName == "ADBE Vector Filter - Trim" || sublayer.matchName == "ADBE Vector Graphic - Trim") {
                styles.trim = {
                    start: sublayer.property('Start').valueAtTime(cTime, false) / 100.0,
                    end: sublayer.property('End').valueAtTime(cTime, false) / 100.0,
                }
            }
            else if (sublayer.matchName == "ADBE Vector Graphic - Stroke") {
                styles.stroke = sublayer.property('Color').valueAtTime(cTime, false)
                styles.strokeWidth = sublayer.property('Stroke Width').valueAtTime(cTime, false)
                let lineCap = sublayer.property('Line Cap').valueAtTime(cTime, false)
                switch (lineCap) {
                    case 1: styles.lineCap = "butt";
                        break;
                    case 2: styles.lineCap = "round";
                        break;
                    case 3: styles.lineCap = "square";
                        break;
                }
                let lineJoin = sublayer.property('Line Join').valueAtTime(cTime, false)
                switch (lineJoin) {
                    case 1: styles.lineJoin = "miter";
                            styles.miterLimit = sublayer.property('Miter Limit').valueAtTime(cTime, false)
                        break;
                    case 2: styles.lineJoin = "round";
                        break;
                    case 3: styles.lineJoin = "bevel";
                        break;
                }
                let dashObject = sublayer.property('Dashes');
                if (dashObject != null && dashObject != undefined) {
                    let j, jLen = dashObject.numProperties;
                    if (jLen > 0) {
                        let dashesData = [];
                        let dash = 0;
                        let gap = 0;
                        let offset = 0;
                        for (j = 0; j < jLen; j += 1) {
                            if (dashObject.property(j + 1).canSetExpression) {
                                var dashData = {};
                                var name = '';
                                if (dashObject.property(j + 1).matchName.indexOf('ADBE Vector Stroke Dash') !== -1) {
                                    dash = dashObject.property(j + 1).valueAtTime(cTime, false);
                                } 
                                else if (dashObject.property(j + 1).matchName.indexOf('ADBE Vector Stroke Gap') !== -1) {
                                    gap = dashObject.property(j + 1).valueAtTime(cTime, false);
                                } 
                                else if (dashObject.property(j + 1).matchName === 'ADBE Vector Stroke Offset') {
                                    offset = dashObject.property(j + 1).valueAtTime(cTime, false);
                                }
                            }
                        }
                        if (dash != 0 || gap != 0 || offset != 0) {
                            styles.lineDash = [dash, gap, offset];
                        }
                    }
                }
            }
        }
        return styles
    }

    requestShapeTransform(parent: AE.AVLayer, cTime: number): SVGA.Matrix2D {
        let transform = parent.property('Transform');
        let rotation = transform["Rotation"].valueAtTime(cTime, false);
        let ax = transform["Anchor Point"].valueAtTime(cTime, false)[0];
        let ay = transform["Anchor Point"].valueAtTime(cTime, false)[1];
        let sx = transform["Scale"].valueAtTime(cTime, false)[0] / 100.0;
        let sy = transform["Scale"].valueAtTime(cTime, false)[1] / 100.0;
        let tx = transform["Position"].valueAtTime(cTime, false)[0];
        let ty = transform["Position"].valueAtTime(cTime, false)[1];
        let matrix = new Matrix();
        matrix.translate(-ax, -ay).scale(sx, sy).rotate(-rotation * Math.PI / 180);
        matrix.translate(tx, ty);
        return {
            a: matrix.props[0],
            b: matrix.props[1],
            c: matrix.props[4],
            d: matrix.props[5],
            tx: matrix.props[12],
            ty: matrix.props[13],
        }
    }

    mergeLayers() {
        let rangeLength = 1;
        for (let index = 0; index < this.layers.length; index += rangeLength) {
            let layer = this.layers[index];
            rangeLength = 1;
            for (let nIndex = index + 1; nIndex < this.layers.length; nIndex++) {
                if (this.layers[nIndex].name === layer.name) {
                    rangeLength++;
                }
                else {
                    break;
                }
            }
            if (rangeLength > 1) {
                let maxInterSets = 1;
                for (let frameNum = 0; frameNum < this.proj.frameCount; frameNum++) {
                    let thisMax = 0;
                    for (let checkIndex = index; checkIndex < index + rangeLength; checkIndex++) {
                        if (this.layers[checkIndex].values.alpha[frameNum] > 0.0) {
                            thisMax++;
                        }
                    }
                    maxInterSets = Math.max(maxInterSets, thisMax);
                }
                if (maxInterSets === 1 || maxInterSets === rangeLength) {
                    continue;
                }
                let mergedLayers: SVGA.Layer[] = [];
                for (let _ = 0; _ < maxInterSets; _++) {
                    mergedLayers.push({
                        name: layer.name,
                        values: {
                            alpha: [],
                            layout: [],
                            matrix: [],
                            mask: [],
                            shapes: [],
                        }
                    });
                }
                for (let frameNum = 0; frameNum < this.proj.frameCount; frameNum++) {
                    let currentLayer = 0;
                    for (let checkIndex = index; checkIndex < index + rangeLength; checkIndex++) {
                        if (this.layers[checkIndex].values.alpha[frameNum] > 0.0) {
                            mergedLayers[currentLayer].values.alpha.push(this.layers[checkIndex].values.alpha[frameNum]);
                            mergedLayers[currentLayer].values.layout.push(this.layers[checkIndex].values.layout[frameNum]);
                            mergedLayers[currentLayer].values.matrix.push(this.layers[checkIndex].values.matrix[frameNum]);
                            mergedLayers[currentLayer].values.mask.push(this.layers[checkIndex].values.mask[frameNum]);
                            mergedLayers[currentLayer].values.shapes.push(this.layers[checkIndex].values.shapes[frameNum]);
                            currentLayer++;
                        }
                    }
                    for (var leftIndex = currentLayer; leftIndex < maxInterSets; leftIndex++) {
                        mergedLayers[leftIndex].values.alpha.push(0.0);
                        mergedLayers[leftIndex].values.layout.push(undefined);
                        mergedLayers[leftIndex].values.matrix.push(undefined);
                        mergedLayers[leftIndex].values.mask.push(undefined);
                        mergedLayers[leftIndex].values.shapes.push(undefined);
                    }
                }
                let replaceLayers = [];
                let startInsertion = false;
                for (let fIndex = 0; fIndex < this.layers.length; fIndex++) {
                    let element = this.layers[fIndex];
                    if (!startInsertion) {
                        if (fIndex < index) {
                            replaceLayers.push(element);
                        }
                        else {
                            startInsertion = true;
                            for (let mIndex = 0; mIndex < mergedLayers.length; mIndex++) {
                                replaceLayers.push(mergedLayers[mIndex]);
                            }
                        }
                    }
                    else {
                        if (fIndex >= index + rangeLength) {
                            replaceLayers.push(element);
                        }
                        else {
                            continue;
                        }
                    }
                }
                this.layers = replaceLayers;
                this.mergeLayers();
                return;
            }
        }
    }
}