@import 'library/sandbox.js'
@import 'library/functions.js'

var l4c = {
  "defs": {
    "pluginVersion": "Version 0.1.0",
    "apiBase": "https://cloud.instantapp.io/",
    "apiSignin": "login",
    "apiUpload": "sketch",
    "apiCheck": "check"
  },

  type: '',
  baseDensity: 0,
  baseDir: '',
  factors: {},
  layerVisibility: [],
  context: undefined,
  document: undefined,
  selection: undefined,

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

  showMessage: function(message, document){
    [document showMessage:message]
  },

  showAlert: function(message, context){
    var alert = NSAlert.alloc().init()
    var plugin = context.plugin
    var imageFilePath=[plugin urlForResourceNamed:"logo.png"]
    var imageData = [NSData dataWithContentsOfURL:imageFilePath]
    var image = NSImage.alloc().initWithData(imageData)
    alert.setIcon(image)
    alert.setMessageText(message)
    alert.addButtonWithTitle("OK")
    alert.runModal()
  },

  // alert: function(msg) {
  //   var app = [NSApplication sharedApplication];
  //   [app displayDialog:msg];
  // },

  isUpdated: function(){
    var version = l4c.getSavedValueFromKey("currentVersion")
    if (version == nil) { return true }
    return ![version isEqualToString: l4c.defs.pluginVersion]
  },


  loginAndExport: function(type, factors, context, document, selection, config) {
    var token = this.getSavedValueFromKey("idToken")
    if (!token) {
      var response = this.showLoginDialog(context);
      if (response[0] == 1000) {
        var loginErrorMsg = this.loginWithEmailAndPassword(response[1], response[2]);
        if (!loginErrorMsg) this.export(type, factors, context, document, selection, config)
        else this.showAlert(loginErrorMsg, context);
      }
    } else {
      if (this.checkTokenValid(token)) this.export(type, factors, context, document, selection, config)
      else {
        response = this.showLoginDialog(context);
        if (response[0] == 1000) {
          var loginErrorMsg = this.loginWithEmailAndPassword(response[1], response[2]);
          if (!loginErrorMsg) this.export(type, factors, context, document, selection, config);
          else this.showAlert(loginErrorMsg, context);
        }
      }
    }
  },

  checkTokenValid: function(token) {
    var token = l4c.getSavedValueFromKey("idToken")
    var task = NSTask.alloc().init()
    task.setLaunchPath("/usr/bin/curl")
    var args = NSArray.arrayWithObjects("-X", "GET", "-H", "Authorization: Bearer " + token, l4c.defs.apiBase + l4c.defs.apiCheck, nil)
    task.setArguments(args)
    var outputPipe = [NSPipe pipe]
    [task setStandardOutput:outputPipe]
    task.launch()

    var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile]
    var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]]
    var outputArray = [NSJSONSerialization JSONObjectWithData:outputData options:NSJSONReadingAllowFragments error:nil]
    log(outputString)
    if(outputString != "success"){
      return false;
    } else {
      return true;
    }
  },

  // type: ios or android
  // factors: scaling factors
  // document: sketch document
  // selection: selected layers
  // config: in config.json
  export: function(type, factors, context, document, selection, config) {
    this.type = type;
    this.factors = factors;
    this.context = context;
    this.document = document;
    this.selection = selection;
    this.config = config;

    // If nothing is selected tell the user so
    if ([selection count] == 0) {
      this.alert("Please select one or more exportable layers to export (or use an Export All command).");
      return;
    }

    this.baseDir = l4c.document.fileURL().URLByDeletingLastPathComponent().path();
    var filename = l4c.document.fileURL().lastPathComponent();

    if (this.config['density-scale'] == undefined) {
      this.config = this.showSettingsDialog();
    }
    this.baseDensity = this.config['density-scale'];

    // Hide all layers except the ones we are slicing
    for (var i = 0; i < [selection count]; i++) {
        var layer = selection[i];
        // Process the slice
        this.processSlice(layer);
    }
    helpers.exec(document, "sketchtool dump \"" + filename + "\" > assets/raw.json");
    helpers.exec(document, "zip -r -X assets.zip assets");
    this.upload(this.baseDir + "/assets.zip", filename, context)
  },

  installSketchtool: function(context) {
    var res = helpers.exec(context.document, "/Applications/Sketch.app/Contents/Resources/sketchtool/install.sh");
    this.showAlert(res, context);
  },

  upload: function(filePath, project, context) {
    var token = l4c.getSavedValueFromKey("idToken")
    var task = NSTask.alloc().init()
    task.setLaunchPath("/usr/bin/curl")
    var args = NSArray.arrayWithObjects("-X", "POST", "-H", "Authorization: Bearer " + token, "-F", "project=" + project, "-F", "assets=@" + filePath, l4c.defs.apiBase + l4c.defs.apiUpload, nil)
    task.setArguments(args)
    var outputPipe = [NSPipe pipe]
    [task setStandardOutput:outputPipe]
    task.launch()

    var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile]
    var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]]
    var outputArray = [NSJSONSerialization JSONObjectWithData:outputData options:NSJSONReadingAllowFragments error:nil]
    log(outputString)
    if(outputString != "success"){
      this.showAlert(outputArray["message"], context)
    } else {
      this.showAlert("upload success", context)
    }
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
    alert.setMessageText("Log into InstantApp")

    [[alert window] setInitialFirstResponder:emailInputField]
    [emailInputField setNextKeyView:passwordInputField]

    var plugin = context.plugin
    var imageFilePath=[plugin urlForResourceNamed:"logo.png"]
    var imageData = [NSData dataWithContentsOfURL:imageFilePath]
    var image = NSImage.alloc().initWithData(imageData)
    alert.setIcon(image)

    var responseCode = alert.runModal()
    return [responseCode, emailInputField.stringValue(), passwordInputField.stringValue()]
  },

  loginWithEmailAndPassword: function(email, password){
    var task = NSTask.alloc().init()
    task.setLaunchPath("/usr/bin/curl")
    var data = "{\"username\":\""+email+"\", \"password\":\""+password+"\"}";
    var args = NSArray.arrayWithObjects("-d", data, "-H", "Content-Type: application/json", "-X", "POST", l4c.defs.apiBase + l4c.defs.apiSignin, nil)
    task.setArguments(args)
    var outputPipe = [NSPipe pipe]
    [task setStandardOutput:outputPipe]
    task.launch()

    var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile]
    var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]]
    var outputArray = [NSJSONSerialization JSONObjectWithData:outputData options:NSJSONReadingAllowFragments error:nil]
    log(outputString)
    if (outputArray["id_token"]) {
      l4c.saveValueForKey(outputArray["id_token"], "idToken");
      return false;
    } else {
      return outputArray["message"];
    }
    // var url = [NSURL URLWithString:l4c.defs.apiBase+l4c.defs.apiSignin]
    // var request = [NSMutableURLRequest requestWithURL:url cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:60]
    // [request setHTTPMethod:"POST"]
    // // [request setValue:"sketch" forHTTPHeaderField:"User-Agent"]
    // [request setValue:"application/json" forHTTPHeaderField:"Content-Type"]
    // [request setValue:"application/json" forHTTPHeaderField:"Accept"]
    // [request setValue:"sketch" forHTTPHeaderField:"App-Type"]

    // var subParameter = NSDictionary.alloc().initWithObjectsAndKeys(email, @"username", password, @"password", nil)
    // var parameter = NSDictionary.alloc().initWithObjectsAndKeys(subParameter, @"user", nil)
    // var postData = [NSJSONSerialization dataWithJSONObject:parameter options:0 error:nil]
    // [request setHTTPBody:postData]
    // log('post data is ' + postData)
    // var response = MOPointer.alloc().init()
    // var error = MOPointer.alloc().init()
    // var data = [NSURLConnection sendSynchronousRequest:request returningResponse:response error:error]
    // log('response is ' + response)
    // log('error is ' + error.value())
    // if (error.value() == nil && data != nil){
    //   var res = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingMutableLeaves error:nil]
    //   l4c.saveValueForKey(res.id_token, "idToken");
    //   return true
    // }else{
    //   return false
    // }
  },

  logoutFromSketch: function(context){
    l4c.saveValueForKey(nil, "idToken")
    l4c.saveValueForKey(nil, "currentVersion")
    this.showAlert("Logout success", context)
  },

  // Let the user specify a directory
  getDirFromPrompt: function() {
      var panel = [NSOpenPanel openPanel];
      [panel setMessage:"Where do you want to place your assets?"];
      [panel setCanChooseDirectories: true];
      [panel setCanChooseFiles: false];
      [panel setCanCreateDirectories: true];
      var defaultDir = l4c.document.fileURL().URLByDeletingLastPathComponent();
      [panel setDirectoryURL:defaultDir];

      if ([panel runModal] == NSOKButton) {
          var message = [panel filename];
          return message;
      }
  },

    showSettingsDialog: function() {
        var folders       = helpers.readPluginPath(),
            settingsInput     = COSAlertWindow.new(),
            densityScales     = ['@1x', '@2x', '@3x'],
            densityScale,
            askForPrefix,
            openFolderExport,
            settings
        ;

        // Load previous settings
        settings = this.readConfig();
        densityScale = [settings valueForKey:@"density-scale"];
        askForPrefix = [settings valueForKey:@"ask-for-prefix"];
        openFolderExport = [settings valueForKey:@"open-folder-export"];

        [settingsInput setMessageText:@'Change settings'];
        [settingsInput addAccessoryView: helpers.createSelect(densityScales, densityScale)];
        [settingsInput addAccessoryView: helpers.createPrefixCheckbox({name:'Ask for prefix on export', value:'1'}, askForPrefix)];
        [settingsInput addAccessoryView: helpers.createOpenCheckbox({name:'Open folder on export', value:'1'}, openFolderExport)];

        [settingsInput addButtonWithTitle:@'Save'];
        [settingsInput addButtonWithTitle:@'Cancel'];

        var responseCode = settingsInput.runModal();

        if ( 1000 == responseCode ) {
            // +1 because 0 means @1x
            //densityScale = [[settingsInput viewAtIndex:0] indexOfSelectedItem] // + 1;
            densityScale = [[settingsInput viewAtIndex:0] indexOfSelectedItem]; // let user choose the density they prefer
            helpers.saveJsonToFile([NSDictionary dictionaryWithObjectsAndKeys:densityScale, @"density-scale", [[settingsInput viewAtIndex:1] state], @"ask-for-prefix", [[settingsInput viewAtIndex:2] state], @"open-folder-export", nil], folders.sketchPluginsPath + folders.pluginFolder + '/config.json');
        }

        return this.readConfig();
    },

    processSlice: function(slice) {
      var frame = [slice frame],
      sliceName = [slice name];

      if (this.type == "android") {
        sliceName = sliceName.trim().toLowerCase().replace(/\s/,'_').replace(/-+/g,'_').replace(/[^0-9a-z_]/,'');
      }

      for (var i = 0; i < this.factors.length; i++) {
        var fileName = '',
          name     = this.factors[i].folder ? '/' + this.factors[i].folder : '',
          factor   = this.factors[i].scale,
          prefix   = '',
          suffix   = '',
          version  = undefined;

          if (this.type == "android") {
            prefix = this.factors[i].prefix;
          }
          suffix = this.factors[i].suffix;

          log("Processing " + this.type + " slices: " + sliceName + " " + name + " (" + factor + ")");

          version = this.makeSliceAndResizeWithFactor(slice, factor);

          if (prefix == null) {
            prefix = ''
          }

          // If we place the assets in the res folder don't place it in an assets/android folder

          if (this.baseDir.indexOf('/res') > -1 && this.type == "android") {
             fileName = this.baseDir + name + "/" + prefix + sliceName + suffix + ".png";
           } else {
             if (this.baseDir.indexOf('/res') == -1 && this.type == "android") {
                 fileName = this.baseDir + "/assets/android/res/" + name + "/" + prefix + sliceName + suffix + ".png";
             } else {
                 fileName = this.baseDir + "/assets/" + this.type + name + "/" + prefix + sliceName + suffix + ".png";
             }
         }

          [(l4c.document) saveArtboardOrSlice: version toFile:fileName];

          log("Saved " + fileName);
      }
    },

    makeSliceAndResizeWithFactor: function(layer, factor) {
        var loopLayerChildren = [[layer children] objectEnumerator],
            sliceLayerAncestry = [MSImmutableLayerAncestry ancestryWithMSLayer:layer];
            rect = [MSSliceTrimming trimmedRectForLayerAncestry:sliceLayerAncestry];
            useSliceLayer = false,
            slice
        ;

        // Check for MSSliceLayer and overwrite the rect if present
        while (layerChild = [loopLayerChildren nextObject]) {
            if ([layerChild class] == 'MSSliceLayer') {
                sliceLayerAncestry = [MSImmutableLayerAncestry ancestryWithMSLayer:layerChild];
                rect = [MSSliceTrimming trimmedRectForLayerAncestry:sliceLayerAncestry];
                useSliceLayer = true;
            }
        }

        var slices = [MSExportRequest exportRequestsFromExportableLayer:layer inRect:rect useIDForName:false];
        var slice = null;
        if (slices.count() > 0) {
            slice = slices[0];
            slice.scale = (factor / (this.baseDensity + 1))
        }

        if (!useSliceLayer) {
            slice.shouldTrim = true;
        }
        // slice.saveForWeb = true;
        // slice.compression = 0;
        // slice.includeArtboardBackground = false;
        return slice;
    },

    readConfig: function(context) {
      var folders = helpers.readPluginPath(context);
      return helpers.jsonFromFile(folders.sketchPluginsPath + folders.pluginFolder + '/config.json', true);
    }
}
