var kUUIDKey = 'google.analytics.uuid';
var uuid = NSUserDefaults.standardUserDefaults().objectForKey(kUUIDKey);
if (!uuid) {
  uuid = NSUUID.UUID().UUIDString();
  NSUserDefaults.standardUserDefaults().setObject_forKey(uuid, kUUIDKey);
}

function jsonToQueryString(json) {
  return (
    '?' +
    Object.keys(json)
      .map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(json[key]);
      })
      .join('&')
  );
}

var send = function(context, props) {
  var payload = {
    v: 1,
    tid: 'UA-108874269-1',
    ds:
      'Sketch%20' +
      NSBundle.mainBundle().objectForInfoDictionaryKey(
        'CFBundleShortVersionString'
      ),
    cid: uuid,
    an: context.plugin.name(),
    aid: context.plugin.identifier(),
    av: context.plugin.version(),
  };
  if (props) {
    Object.keys(props).forEach(function(key) {
      payload[key] = props[key];
    });
  }
  if (payload['exd']) {
    payload.t = 'exception';
  } else {
    payload.t = 'event';
  }
  var url = NSURL.URLWithString(
    NSString.stringWithFormat(
      'https://www.google-analytics.com/collect%@',
      jsonToQueryString(payload)
    )
  );

  if (url) {
    NSURLSession.sharedSession()
      .dataTaskWithURL(url)
      .resume();
  }
};

var ga = {
  send: send,
};
