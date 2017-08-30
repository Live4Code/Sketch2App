@import 'library/functions.js'

var l4c = {
  "defs": {
    "pluginVersion": "Version 0.3.2",
    "apiBase": "https://cloud.appchef.io/",
    "apiSignin": "login",
    "apiUpload": "sketch",
    "apiCheck": "check",
    "localFolder": "appchef",
    "factors": [
      // {
      //     "scale": 1.0,
      //     "suffix": "",
      // },
      {
          "scale": 2.0,
          "suffix": "@2x",
      },
      // {
      //     "scale": 3.0,
      //     "suffix": "@3x",
      // }
    ]
  },

  getUnarchivedObjectFromData: function(data){
    return [NSKeyedUnarchiver unarchiveObjectWithData:data]
  },

  setArchivedObjectForData: function(data){
    return [NSKeyedArchiver archivedDataWithRootObject:data]
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

  isUpdated: function(){
    var version = l4c.getSavedValueFromKey("currentVersion")
    if (version == nil) { return true }
    return ![version isEqualToString: l4c.defs.pluginVersion]
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
    [request setValue:"sketch" forHTTPHeaderField:"App-Type"]
    [request setValue:token forHTTPHeaderField:"Authorization"]

    var response = MOPointer.alloc().init()
    var error = MOPointer.alloc().init()
    var data = [NSURLConnection sendSynchronousRequest:request returningResponse:response error:error]
    if (error.value() == nil && data != nil){
      var res = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil]
      if (res.message == "success") return true
      else return false
    } else {
      l4c.showAlert("😞 Token has expired. Please login again.", context)
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
    alert.setMessageText("Log into InstantApp and Upload. Upload will take some time. After complete, you will see success message in a new modal dialog.")

    [[alert window] setInitialFirstResponder:emailInputField]
    [emailInputField setNextKeyView:passwordInputField]

    var responseCode = alert.runModal()
    return [responseCode, emailInputField.stringValue(), passwordInputField.stringValue()]
  },

  loginWithEmailAndPassword: function(email, password){
    var url = [NSURL URLWithString:l4c.defs.apiBase + l4c.defs.apiSignin]
    var request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:60]
    [request setHTTPMethod:"POST"]
    [request setValue:"sketch" forHTTPHeaderField:"User-Agent"]
    [request setValue:"application/json" forHTTPHeaderField:"Content-Type"]
    [request setValue:"sketch" forHTTPHeaderField:"App-Type"]

    var parameter = NSDictionary.alloc().initWithObjectsAndKeys(email, @"username", password, @"password", nil)
    var postData = [NSJSONSerialization dataWithJSONObject:parameter options:0 error:nil]
    [request setHTTPBody:postData]

    var response = MOPointer.alloc().init()
    var error = MOPointer.alloc().init()
    var data = [NSURLConnection sendSynchronousRequest:request returningResponse:response error:error]
    if (error.value() == nil && data != nil){
      var res = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil]
      l4c.saveValueForKey(res.id_token, "idToken")
      return true
    } else {
      return error.value()
    }
  },

  loginToExport: function(context) {
    var response = l4c.showLoginDialog(context)
    if (response[0] == 1000) {
      var response = l4c.loginWithEmailAndPassword(response[1], response[2])
      l4c.showMessage("Login Success. Generating Schema ...", context)
      if (response == 1) {
        l4c.exportSchema(context)
      }
      else {
        l4c.showAlert("Something went wrong. Please check your credentials and try again", context)
      }
    }
  },

  exportWithoutLogin: function(context) {
    var response = l4c.showUploadDialog(context)
    if (response == 1000) l4c.exportSchema(context)
  },

  exportSchema: function(context) {
    var document = context.document
    var baseDir = helpers.getCurrentDirectory(document)
    var filename = document.fileURL().lastPathComponent()
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder)
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder + "-schema.zip")
    helpers.removeFileOrFolder(baseDir + "/" + l4c.defs.localFolder + "-assets.zip")
    helpers.createFolderAtPath(baseDir + "/" + l4c.defs.localFolder)
    helpers.exec(document, "sketchtool dump \"" + filename + "\" > " + l4c.defs.localFolder + "/raw.json")
    helpers.exec(document, "zip -r -X " + l4c.defs.localFolder + "-schema.zip " + l4c.defs.localFolder)
    l4c.upload(baseDir + "/" + l4c.defs.localFolder + "-schema.zip", filename, 'schema', context)
  },

  exportAssets: function(context) {
    var document = context.document
    var selection = document.allExportableLayers()
    var baseDir = helpers.getCurrentDirectory(document)
    var filename = document.fileURL().lastPathComponent()
    for (var i = 0; i < [selection count]; i++) {
      var layer = selection[i]
      l4c.processSlice(layer, document)
    }
    helpers.exec(document, "zip -r -X " + l4c.defs.localFolder + "-assets.zip " + l4c.defs.localFolder + "/images")
    l4c.upload(baseDir + "/" + l4c.defs.localFolder + "-assets.zip", filename, 'assets', context)
  },

  processSlice: function(slice, document) {
    var frame = [slice frame]
    var sliceName = [slice name]
    var baseDir = helpers.getCurrentDirectory(document)

    for (var i = 0; i < l4c.defs.factors.length; i++) {
      var scale = l4c.defs.factors[i].scale
      var suffix = l4c.defs.factors[i].suffix
      var version = l4c.makeSliceAndResizeWithFactor(slice, scale)
      var fileName = baseDir + "/" + l4c.defs.localFolder + "/images/" + sliceName + suffix + ".png"
      [document saveArtboardOrSlice: version toFile: fileName]
      //don't save again in ios folder
      //var iosFileName = baseDir + "/" + l4c.defs.localFolder + "/ios/" + sliceName + suffix + ".png"
      //[document saveArtboardOrSlice: version toFile: iosFileName]
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
    var token = l4c.getSavedValueFromKey("idToken")
    var task = NSTask.alloc().init()
    task.setLaunchPath("/usr/bin/curl")
    var args = NSArray.arrayWithObjects("-X", "POST", "-H", "Authorization: Bearer " + token, "-F", "project=" + project, "-F", "type=" + type, "-F", "assets=@" + filePath, l4c.defs.apiBase + l4c.defs.apiUpload, nil)
    task.setArguments(args)
    var outputPipe = [NSPipe pipe]
    [task setStandardOutput:outputPipe]
    task.launch()

    var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile]
    var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]]
    var outputArray = [NSJSONSerialization JSONObjectWithData:outputData options:NSJSONReadingAllowFragments error:nil]
    log(outputString)
    if(outputArray["message"] != "success"){
      l4c.showAlert(outputArray["message"], context)
    } else {
      if (type === 'schema') {
        l4c.showMessage("Sketch schema upload success. Now uploading image assets, upload time depends on the size of assets. Please wait and don't close sketch ...", context)
        l4c.exportAssets(context)
      } else {
        l4c.showAlert("👍 Upload success. Please check cloud.appchef.io for app building progress.", context)
      }
    }
  },

  installSketchtool: function(context) {
    try {
      var res = helpers.exec(context.document, "/Applications/Sketch.app/Contents/Resources/sketchtool/install.sh")
      l4c.showAlert(res, context)
    } catch (error) {
      log("receive error " + error)
      l4c.showAlert("Install sketchtool failed. Please install Homebrew and try again.", context)
    }
  },

  logoutFromSketch: function(context){
    l4c.saveValueForKey(nil, "idToken")
    l4c.saveValueForKey(nil, "currentVersion")
    l4c.showMessage("Logout success", context)
  },

  readConfig: function(context) {
    var folders = helpers.readPluginPath(context)
    return helpers.jsonFromFile(folders.sketchPluginsPath + folders.pluginFolder + '/config.json', true)
  }

}
