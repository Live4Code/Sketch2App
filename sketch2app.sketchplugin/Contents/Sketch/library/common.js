var writeTextToFile = function(text, filePath) {
  var t = [NSString stringWithFormat:@"%@", text],
  f = [NSString stringWithFormat:@"%@", filePath];
  return [t writeToFile:f atomically:true encoding:NSUTF8StringEncoding error:nil];
}

var readTextFromFile = function(filePath) {
  var fileManager = [NSFileManager defaultManager];
  if([fileManager fileExistsAtPath:filePath]) {
    return [NSString stringWithContentsOfFile:filePath encoding:NSUTF8StringEncoding error:nil];
  }
  return nil;
}

var jsonFromFile = function(filePath, mutable) {
  var data = [NSData dataWithContentsOfFile:filePath];
  var options = mutable == true ? NSJSONReadingMutableContainers : 0
  return [NSJSONSerialization JSONObjectWithData:data options:options error:nil];
}

var saveJsonToFile = function(jsonObj, filePath) {
  writeTextToFile(stringify(jsonObj), filePath);
}

var stringify = function(obj, prettyPrinted) {
  var prettySetting = prettyPrinted ? NSJSONWritingPrettyPrinted : 0,
  jsonData = [NSJSONSerialization dataWithJSONObject:obj options:prettySetting error:nil];
  return [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
}

var createTempFolderNamed = function(name) {
  var tempPath = getTempFolderPath(name);
  createFolderAtPath(tempPath);
  return tempPath;
}

var getTempFolderPath = function(withName) {
  var fileManager = [NSFileManager defaultManager],
  cachesURL = [[fileManager URLsForDirectory:NSCachesDirectory inDomains:NSUserDomainMask] lastObject],
  withName = (typeof withName !== 'undefined') ? withName : (Date.now() / 1000),
  folderName = [NSString stringWithFormat:"%@", withName];
  return [[cachesURL URLByAppendingPathComponent:folderName] path];
}

var createFolderAtPath = function(pathString) {
  var fileManager = [NSFileManager defaultManager];
  if([fileManager fileExistsAtPath:pathString]) return true;
  return [fileManager createDirectoryAtPath:pathString withIntermediateDirectories:true attributes:nil error:nil];
}

var removeFileOrFolder = function(filePath) {
  [[NSFileManager defaultManager] removeItemAtPath:filePath error:nil];
}

var readPluginPath = function(context) {
  var sketchPluginsPath = context.scriptPath.replace(/Sketch([\w \/ -])*.sketchscript$/, "");
  return {
    sketchPluginsPath: sketchPluginsPath,
    pluginFolder: 'Resources'
  }
}

var openInFinder = function(path) {
  var finderTask = [[NSTask alloc] init],
    openFinderArgs = [NSArray arrayWithObjects:"-R", path, nil];

  [finderTask setLaunchPath:"/usr/bin/open"];
  [finderTask setArguments:openFinderArgs];
  [finderTask launch];
}

var exec = function(document, command) {
  var task = NSTask.alloc().init();
  var pipe = NSPipe.pipe();
  var errPipe = NSPipe.pipe();

  var path = getCurrentDirectory(document);
  command = 'cd "' + path + '" && ' + command;

  task.setLaunchPath_('/bin/bash');
  task.setArguments_(NSArray.arrayWithObjects_('-c', '-l', command, null));
  task.standardOutput = pipe;
  task.standardError = errPipe;
  task.launch();

  var errData = errPipe.fileHandleForReading().readDataToEndOfFile();
  var data = pipe.fileHandleForReading().readDataToEndOfFile();

  if (task.terminationStatus() != 0) {
    var message = errData != null && errData.length() ? NSString.alloc().initWithData_encoding_(errData, NSUTF8StringEncoding) : 'Unknow error';
    return NSException.raise_format_('failed', message);
  }

  return NSString.alloc().initWithData_encoding_(data, NSUTF8StringEncoding);
}

var getCurrentDirectory = function(document) {
  return document.fileURL().URLByDeletingLastPathComponent().path();
}

var helpers = {
  readTextFromFile: readTextFromFile,
  writeTextToFile: writeTextToFile,
  jsonFromFile: jsonFromFile,
  saveJsonToFile: saveJsonToFile,
  createFolderAtPath: createFolderAtPath,
  removeFileOrFolder: removeFileOrFolder,
  readPluginPath: readPluginPath,
  openInFinder: openInFinder,
  exec: exec,
  getCurrentDirectory: getCurrentDirectory
}
