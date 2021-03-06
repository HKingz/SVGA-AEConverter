/// <reference path="../declear/ae.declare.ts" />
/// <reference path="../declear/svga.declare.ts" />
/// <reference path="../converter/converter.ts" />
/// <reference path="../writer/writer.ts" />
/**
 * Author: Pony Cui
 * Date: 2016.08.01
 * Dev: TypeScript 1.8
 * Env: After Effects CC 2015
 * Build: npm install & npm start
 */
var startConvert = function (outputPath) {
    //将路径和文件名称分离
    var pathArr = outputPath.split('/');
    pathArr.pop();
    var path = pathArr.join('/') + "/svga_works";
    var thisConverter = new Converter(app);
    var thisWriter = new Writer(thisConverter, path);
    thisWriter.write();
    return path;
};
