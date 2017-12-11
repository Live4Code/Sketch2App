@import 'library/common.js'
@import 'library/analytics.js'

var l4c = {
  "defs": {
    "pluginVersion": "Version 0.4.3",
    "apiBase": "https://cloud.appchef.io/",
    "apiSignin": "login",
    "apiUpload": "sketch",
    "apiCheck": "check",
    "apiLog": "log",
    "localFolder": "appchef",
    "factors": [
      {
        "scale": 2.0,
        "suffix": "@2x",
      }
    ]
  },

  getSavedValueFromKey: function(key){
    return [[NSUserDefaults standardUserDefaults] objectForKey:key]
  },
  
  saveValueForKey: function(value, key){
    [[NSUserDefaults standardUserDefaults] setObject:value forKey:key]
    [[NSUserDefaults standardUserDefaults] synchronize]
  },

  showMessage: function(message, context){
    var document = context.document
    document.showMessage(message)
  },

  showAlert: function(message, context){
    var alert = NSAlert.alloc().init()
    alert.setMessageText(message)
    alert.addButtonWithTitle("OK")
    alert.runModal()
  },

  tokenValid: function(context) {
    var idToken = l4c.getSavedValueFromKey("idToken")
    log("get saved token " + idToken)
    if (!idToken) return false
    var token = "Bearer " + idToken
    var url = [NSURL URLWithString:l4c.defs.apiBase + l4c.defs.apiCheck]
    var request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:60]
    [request setHTTPMethod:"GET"]
    [request setValue:"sketch" forHTTPHeaderField:"User-Agent"]
    [request setValue:"application/json" forHTTPHeaderField:"Content-Type"]
    [request setValue:token forHTTPHeaderField:"Authorization"]

    var response = MOPointer.alloc().init()
    var error = MOPointer.alloc().init()
    var data = [NSURLConnection sendSynchronousRequest:request returningResponse:response error:error]
    if (error.value() == nil && data != nil){
      var res = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil]
      if (res.message == "success") return true
      else return false
    } else {
      l4c.showAlert("😞 User session expired. Please login again.", context)
      return false
    }
  },

  showUploadDialog: function(context) {
    var accessoryView = NSView.alloc().initWithFrame(NSMakeRect(0.0, 0.0, 260.0, 50.0))
    var alert = NSAlert.alloc().init()
    alert.addButtonWithTitle("Upload")
    alert.addButtonWithTitle("Cancel")
    alert.setAccessoryView(accessoryView)
    alert.setMessageText("Click Upload to start. Upload will take some time. After complete, you will see success message in a new modal dialog.")
    var responseCode = alert.runModal()
    return responseCode
  },

  showLoginDialog: function(context){
    var accessoryView = NSView.alloc().initWithFrame(NSMakeRect(0.0, 0.0, 260.0, 50.0))

    var emailInputField = NSTextField.alloc().initWithFrame(NSMakeRect(0.0, 30.0, 260.0, 20.0))
    emailInputField.cell().setPlaceholderString("Email")
    accessoryView.addSubview(emailInputField)

    var passwordInputField = NSSecureTextField.alloc().initWithFrame(NSMakeRect(0.0, 0.0, 260.0, 20.0))
    passwordInputField.cell().setPlaceholderString("Password")
    accessoryView.addSubview(passwordInputField)

    var alert = NSAlert.alloc().init()
    alert.addButtonWithTitle("Login")
    alert.addButtonWithTitle("Cancel")
    alert.setAccessoryView(accessoryView)
    alert.setMessageText("Login and Upload. Upload will take some time. After complete, you will see success message in the dialog.")

    [[alert window] setInitialFirstResponder:emailInputField]
    [emailInputField setNextKeyView:passwordInputField]

    var responseCode = alert.runModal()
    return [responseCode, emailInputField.stringValue(), passwordInputField.stringValue()]
  },

  loginWithEmailAndPassword: function(context, email, password){
    var url = [NSURL URLWithString:l4c.defs.apiBase + l4c.defs.apiSignin]
    var request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:60]
    [request setHTTPMethod:"POST"]
    [request setValue:"sketch" forHTTPHeaderField:"User-Agent"]
    [request setValue:"application/json" forHTTPHeaderField:"Content-Type"]

    var parameter = {"username": email, "password": password}
    var postData = [NSJSONSerialization dataWithJSONObject:parameter options:0 error:nil]
    [request setHTTPBody:postData]

    var response = MOPointer.alloc().init()
    var error = MOPointer.alloc().init()
    var data = [NSURLConnection sendSynchronousRequest:request returningResponse:response error:error]
    if (error.value() == nil && data != nil){
      var res = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil]
      l4c.saveValueForKey(res.id_token, "idToken")
      l4c.saveValueForKey(res.user_id, "userId")
      ga.send(context, {ec: 'login', ea: 'login', el: email, ev: 1, uid: res.user_id})
      return true
    } else {
      ga.send(context, {exd: 'LoginError-'+email, exf: 0, uid: res.user_id, el: email, ev: 1})
      return error.value()
    }
  },

  loginToExport: function(context) {
    var response = l4c.showLoginDialog(context)
    if (response[0] == 1000) {
      var response = l4c.loginWithEmailAndPassword(context, response[1], response[2])
      l4c.showMessage("Login Success. Generating Schema ...", context)
      if (response == 1) {
        l4c.exportSchema(context)
      } else {
        l4c.showAlert("Login failed. Please check your credentials and try again", context)
      }
    }
  },

  exportWithoutLogin: function(context) {
    var response = l4c.showUploadDialog(context)
    if (response == 1000) l4c.exportSchema(context)
  },

  exportSchema: function(context) {
    var uid = l4c.getSavedValueFromKey("userId")
    var document = context.document
    var baseDir = helpers.getCurrentDirectory(document)
    var filename = document.fileURL().lastPathComponent()
    var logging = filename + ", "
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder)
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder + "-schema.zip")
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder + "-assets.zip")
    helpers.createFolderAtPath(baseDir + "/" + l4c.defs.localFolder)
    l4c.logger(context, "debug", logging + "create local appchef folder " + l4c.defs.localFolder)
    try {
      helpers.exec(document, "sketchtool dump \"" + filename + "\" > " + l4c.defs.localFolder + "/raw.json")
      l4c.logger(context, "debug", logging + "generated sketch json schema")      
    } catch (err) {
      ga.send(context, {exd: 'SketchToolDumpError', uid: uid, el: uid, ev: 1})
      l4c.showAlert("Use sketchtool failed. Please install Homebrew and try install sketchtool again.", context)
      l4c.logger(context, "error", logging + "fail to call sketchtool dump. Error is " + JSON.stringify(err))  
    }
    try {
      helpers.exec(document, "zip -r -X " + l4c.defs.localFolder + "-schema.zip " + l4c.defs.localFolder)
    } catch (err) {
      ga.send(context, {exd: 'CompressError', uid: uid, el: uid, ev: 1})
      l4c.showAlert("Compress the appchef folder failed. Please contact us to fix the problem.", context)
      l4c.logger(context, "error", logging + "fail to compress appchef schema folder. Error is " + JSON.stringify(err))  
    }
    l4c.upload(baseDir + "/" + l4c.defs.localFolder + "-schema.zip", filename, 'schema', context)
  },

  exportAssets: function(context) {
    var uid = l4c.getSavedValueFromKey("userId")
    var document = context.document
    var selection = document.allExportableLayers()
    var baseDir = helpers.getCurrentDirectory(document)
    var filename = document.fileURL().lastPathComponent()
    var logging = filename + ", "
    for (var i = 0; i < [selection count]; i++) {
      var layer = selection[i]
      l4c.processSlice(layer, document)
    }
    l4c.logger(context, "debug", logging + "exported all assets from sketch") 
    try {
      helpers.exec(document, "zip -r -X " + l4c.defs.localFolder + "-assets.zip " + l4c.defs.localFolder + "/images")
    } catch (err) {
      l4c.showAlert("Compress the appchef folder failed. Please contact us to fix the problem.", context)
      l4c.logger(context, "error", logging + "fail to compress appchef schema folder. Error is " + JSON.stringify(err))
    }
    l4c.upload(baseDir + "/" + l4c.defs.localFolder + "-assets.zip", filename, 'assets', context)
  },

  processSlice: function(slice, document) {
    var frame = [slice frame]
    var objectID = [slice objectID]
    var sliceName = ([slice name]).replace(/[^A-Za-z0-9._-]/g, '-')
    var baseDir = helpers.getCurrentDirectory(document)

    for (var i = 0; i < l4c.defs.factors.length; i++) {
      var scale = l4c.defs.factors[i].scale
      var suffix = l4c.defs.factors[i].suffix
      var version = l4c.makeSliceAndResizeWithFactor(slice, scale)
      var fileName = baseDir + "/" + l4c.defs.localFolder + "/images/" + sliceName + "-" + objectID + suffix + ".png"
      [document saveArtboardOrSlice: version toFile: fileName]
      log("Saved " + fileName)
    }
  },

  makeSliceAndResizeWithFactor: function(layer, scale) {
    var loopLayerChildren = [[layer children] objectEnumerator]
    var sliceLayerAncestry = [MSImmutableLayerAncestry ancestryWithMSLayer:layer]
    var rect = [MSSliceTrimming trimmedRectForLayerAncestry:sliceLayerAncestry]
    var useSliceLayer = false

    // Check for MSSliceLayer and overwrite the rect if present
    while (layerChild = [loopLayerChildren nextObject]) {
      if ([layerChild class] == 'MSSliceLayer') {
        sliceLayerAncestry = [MSImmutableLayerAncestry ancestryWithMSLayer:layerChild]
        rect = [MSSliceTrimming trimmedRectForLayerAncestry:sliceLayerAncestry]
        useSliceLayer = true
      }
    }

    var slices = [MSExportRequest exportRequestsFromExportableLayer:layer inRect:rect useIDForName:false]
    var slice = null
    if (slices.count() > 0) {
      slice = slices[0]
      slice.scale = scale
    }

    if (!useSliceLayer) {
      slice.shouldTrim = true
    }
    return slice
  },

  upload: function(filePath, project, type, context) {
    var uid = l4c.getSavedValueFromKey("userId")
    var token = l4c.getSavedValueFromKey("idToken")
    var task = NSTask.alloc().init()
    var logging = project + ", "
    task.setLaunchPath("/usr/bin/curl")
    var args = NSArray.arrayWithArray(["-X", "POST", "-H", "Authorization: Bearer " + token, "-F", "project=" + project, "-F", "type=" + type, "-F", "assets=@" + filePath, l4c.defs.apiBase + l4c.defs.apiUpload])
    task.setArguments(args)
    var outputPipe = [NSPipe pipe]
    [task setStandardOutput:outputPipe]
    task.launch()
    var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile]
    var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]]
    var outputArray = [NSJSONSerialization JSONObjectWithData:outputData options:NSJSONReadingAllowFragments error:nil]
    log(outputString)
    if(outputArray["message"] != "success"){
      ga.send(context, {exd: 'UploadError', exf: 1, uid: uid, el: uid, ev: 1})
      l4c.logger(context, "error", logging + "fail to upload " + type + ". Error is " + outputArray["message"])
      l4c.showAlert(outputArray["message"], context)
    } else {
      l4c.logger(context, "debug", logging + "success upload " + type)
      if (type === 'schema') {
        l4c.showMessage("Sketch schema upload success. Now uploading image assets, upload time depends on the size of assets. Please wait and don't close sketch ...", context)
        l4c.exportAssets(context)
      } else {
        ga.send(context, {ec: 'upload', ea: 'upload', uid: uid, el: uid, ev: 1})
        l4c.showAlert("👍 Upload success. Open the Appchef app on your phone to see the project.", context)
      }
    }
  },

  logger: function(context, level, message){
    log('send message ' + level + ' ' + message);
    var url = [NSURL URLWithString:l4c.defs.apiBase + l4c.defs.apiLog]
    var token = "Bearer "+l4c.getSavedValueFromKey("idToken")
    var request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:60]
    [request setHTTPMethod:"POST"]
    [request setValue:"sketch" forHTTPHeaderField:"User-Agent"]
    [request setValue:"application/json" forHTTPHeaderField:"Content-Type"]
    [request setValue:token forHTTPHeaderField:"Authorization"]

    var parameter = {"message": message, "level": level};
    var postData = [NSJSONSerialization dataWithJSONObject:parameter options:0 error:nil]
    [request setHTTPBody:postData]
    [NSURLConnection sendSynchronousRequest:request returningResponse:nil error:nil]
  },

  installSketchtool: function(context) {
    var uid = l4c.getSavedValueFromKey("userId")
    try {
      var res = helpers.exec(context.document, "/Applications/Sketch.app/Contents/Resources/sketchtool/install.sh")
      ga.send(context, {ec: 'install-sketchtool', ea: 'install-sketchtool', uid: uid, el: uid, ev: 1})
      l4c.showAlert(res, context)
    } catch (error) {
      ga.send(context, {exd: 'InstallSketchToolError', exf: 1, uid: uid, el: uid, ev: 1})
      log("receive error " + error)
      l4c.logger(context, "error", "Fail to install sketchtool. Error is " + JSON.stringify(error))
      l4c.showAlert("Install sketchtool failed. Please install Homebrew and try again.", context)
    }
  },

  logoutFromSketch: function(context){
    var uid = l4c.getSavedValueFromKey("userId")
    ga.send(context, {ec: 'logout', ea: 'logout', uid: uid, el: uid, ev: 1})
    l4c.saveValueForKey(nil, "idToken")
    l4c.saveValueForKey(nil, "userId")
    l4c.saveValueForKey(nil, "currentVersion")
    l4c.showMessage("Logout success", context)
  },

}
