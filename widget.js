/* global requirejs cprequire cpdefine chilipeppr THREE */
// Defining the globals above helps Cloud9 not show warnings for those variables

// ChiliPeppr Widget/Element Javascript

requirejs.config({
   
  paths: {
    // Example of how to define the key (you make up the key) and the URL
    // Make sure you DO NOT put the .js at the end of the URL
    // SmoothieCharts: '//smoothiecharts.org/smoothie',
    Chart : 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.7.2/Chart.min',
    socketio: 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.1.1/socket.io',
  },
  shim: {
    // See require.js docs for how to define dependencies that
    // should be loaded before your script/widget.
  }
});

cprequire_test(["inline:com-chilipeppr-widget-myhomecnc"], function(myWidget) {

    // Test this element. This code is auto-removed by the chilipeppr.load()
    // when using this widget in production. So use the cpquire_test to do things
    // you only want to have happen during testing, like loading other widgets or
    // doing unit tests. Don't remove end_test at the end or auto-remove will fail.

    // Please note that if you are working on multiple widgets at the same time
    // you may need to use the ?forcerefresh=true technique in the URL of
    // your test widget to force the underlying chilipeppr.load() statements
    // to referesh the cache. For example, if you are working on an Add-On
    // widget to the Eagle BRD widget, but also working on the Eagle BRD widget
    // at the same time you will have to make ample use of this technique to
    // get changes to load correctly. If you keep wondering why you're not seeing
    // your changes, try ?forcerefresh=true as a get parameter in your URL.

    console.log("test running of " + myWidget.id);

    $('body').prepend('<div id="testDivForFlashMessageWidget"></div>');

    chilipeppr.load(
        "#testDivForFlashMessageWidget",
        "http://raw.githubusercontent.com/chilipeppr/element-flash/master/auto-generated-widget.html",
        function() {
            console.log("mycallback got called after loading flash msg module");
            cprequire(["inline:com-chilipeppr-elem-flashmsg"], function(fm) {
                //console.log("inside require of " + fm.id);
                fm.init();
            });
        }
    );

    // init my widget
    myWidget.init();
    $('#' + myWidget.id).css('margin', '20px');
    $('title').html(myWidget.name);

} /*end_test*/ );

// This is the main definition of your widget. Give it a unique name.
cpdefine("inline:com-chilipeppr-widget-myhomecnc", ["chilipeppr_ready", "Chart", "socketio", /* other dependencies here */ ], function(chilipeppr_ready, Chart, io) {
    return {
        /**
         * The ID of the widget. You must define this and make it unique.
         */
        id: "com-chilipeppr-widget-myhomecnc", // Make the id the same as the cpdefine id
        name: "Widget / myHomeCNC", // The descriptive name of your widget.
        desc: "This widget interfaces the different features and devices of myHomeCNC project. It requires a special control board, different sensors, and all connected to a Raspberry Pi with a Server code in Python. \
              External modules used : Socket.io and Chart.js", // A description of what your widget does
        url: "(auto fill by runme.js)",       // The final URL of the working widget as a single HTML file with CSS and Javascript inlined. You can let runme.js auto fill this if you are using Cloud9.
        fiddleurl: "(auto fill by runme.js)", // The edit URL. This can be auto-filled by runme.js in Cloud9 if you'd like, or just define it on your own to help people know where they can edit/fork your widget
        githuburl: "(auto fill by runme.js)", // The backing github repo
        testurl: "(auto fill by runme.js)",   // The standalone working widget so can view it working by itself
        
        /**
         * Define the publish signals that this widget/element owns or defines so that
         * other widgets know how to subscribe to them and what they do.
         */
        publish: {
            // Define a key:value pair here as strings to document what signals you publish.
            // '/onExampleGenerate': 'Example: Publish this signal when we go to generate gcode.'
        },
        /**
         * Define the subscribe signals that this widget/element owns or defines so that
         * other widgets know how to subscribe to them and what they do.
         */
        subscribe: {
            // Define a key:value pair here as strings to document what signals you subscribe to
            // so other widgets can publish to this widget to have it do something.
            // '/onExampleConsume': 'Example: This widget subscribe to this signal so other widgets can send to us and we'll do something with it.'
        },
        /**
         * Document the foreign publish signals, i.e. signals owned by other widgets
         * or elements, that this widget/element publishes to.
         */
        foreignPublish: {
            // Define a key:value pair here as strings to document what signals you publish to
            // that are owned by foreign/other widgets.
            // '/jsonSend': 'Example: We send Gcode to the serial port widget to do stuff with the CNC controller.'
        },
        /**
         * Document the foreign subscribe signals, i.e. signals owned by other widgets
         * or elements, that this widget/element subscribes to.
         */
        foreignSubscribe: {
            // Define a key:value pair here as strings to document what signals you subscribe to
            // that are owned by foreign/other widgets.
            // '/com-chilipeppr-elem-dragdrop/ondropped': 'Example: We subscribe to this signal at a higher priority to intercept the signal. We do not let it propagate by returning false.'
        },
        
        init: function(host) {

          console.log("myHomeCNC : I am being initted. Thanks.");
          
          var that = this;
          
          // Reset main vars
          this.isSioConnected = true;
          this.isSPJSConnected = true;
          this.isSerialConnected = true;
          this.iseStopActive = false;
          this.isPWMAvailable = true;
          this.cncMode = 5;
          
          // Setup UI
          this.forkSetup();
          this.setupUiFromLocalStorage();
          this.setupLog();
          this.setupBody();
          this.btnSetup();

          // setup onconnect pubsub event for foreign signal from SPJS
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/ws/onconnect", this, function (payload) {
            // whether ws was just connected.
            // payload from SPJS widget => msg = {websocket:this.conn, host:this.activehost}
            that.pubLog('spjs', 'in', '/onconnect', payload);
            
            that.wsHost = payload.host;
      
            that.isSPJSConnected = true;
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/ws/ondisconnect", this, function (payload) {
            // Whether ws was just disconnected. 
            // payload from SPJS => msg = "disconnected"
            that.pubLog('spjs', 'in', '/ondisconnect', payload);
            
            that.isSPJSConnected = false;
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/recvStatus", this, function (payload) {
            // Wheter ws is connected to SPJS. Payload from SPJS widget => '{"connected":true, "Websocket": ws } or {"connected":false, "websocket":null}
            that.pubLog('spjs', 'in', '/recvStatus', payload);
            
            this.isSPJSConnected = payload.connected;
            
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onportopen", this, function (payload) {
            // payload from SPJS=> {Cmd: "Open", Desc: "Got register/open on port.", Port: "COM22", Baud: 115200, BufferType: "tinyg"}
            that.pubLog('spjs', 'in', '/onportopen', payload);
            
            if (payload.Cmd == "Open" && payload.Desc == "Got register/open on port." && payload.BufferType.includes("tiny")) {
              that.isSerialConnected = true;
            } else {
              that.isSerialConnected = false;
            }
            that.portName = payload;
            
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onportclose", this, function (payload) {
            // payload from SPJS => {Cmd: "Close", Desc: "Got unregister/close on port.", Port: "COM22", Baud: 115200}
            that.pubLog('spjs', 'in', '/onportclose', payload)
            
            if (payload.Cmd == 'Close') {
              that.isSerialConnected = false;
            } else {
              that.isSerialConnected = true;
            }
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/list", this, function (payload) {
            // payloas from SPJS is an array like => {"SerialPorts": [{"Name": "/dev/ttymxc3","Friendly": "/dev/ttymxc3","SerialNumber": "","DeviceClass": "","IsOpen": true,"IsPrimary": true,"RelatedNames": null,"Baud": 115200,"BufferAlgorithm": "","AvailableBufferAlgorithms": ["default","tinyg","tinygg2","grbl","marlin"],"Ver": 1.83,"UsbVid": "","UsbPid": ""}
            var andThat = this;
            
            that.pubLog('spjs', 'in', '/list', payload);
            
            if (payload) {
              andThat.openPort = payload.SerialPorts.filter(function(item) {
                return (item.IsOpen && item.IsPrimary && item.BufferAlgorithm.includes("tiny"));  
              }); 
              if (this.openPort.length == 1) {
                that.isSerialConnected = true;
              } else {
                that.isSerialConnected = false;
              }
            } else {
              that.isSerialConnected = false;
            }
            that.portName = this.openPort;
            
            that.setupPermissions();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onComplete", this, function (msg) {
            // payload from SPJS => '{"Id":"123"}'
          });
          
          this.requestChilipepprInfo();
          
          /* Foreign publish
          /com-chilipeppr-widget-serialport/jsonSend => {"D": "G0 X1 ", "Id":"123"} callback on /onQueue, /onWrite, /onComplete
          /com-chilipeppr-widget-serialport/send => "G1 X10 F500\n" to send Gcode to default port
          */

          // setup low-level send pubsub event
          // this is when any widget sends wants to send data data to the socket
          chilipeppr.subscribe("/" + this.id + "/send", this, function (key, message) {
            
            this.wsSend(key, message);
          });
          chilipeppr.subscribe("/" + this.id + "/getstatus", this, function () {
            
            this.publishStatus();
          });
          chilipeppr.subscribe("/" + this.id + "/getfeedback", this, function (key) {
            
            //this.publishFeedback(key, msg);
          });
          

          this.setupCharts();
          
          this.sioConnect(host);
          
          //this.logEnabled = true;
          //this.pubLog('spjs', 'out', 'welcome', 'hello');
          
          
          console.log("myHomeCNC : I am done being initted.");
        },
        setupConnection: function () {
          var that = this;

          this.setupPermissions();

          // show last remote host, if there is one
          var lasthost = this.options.myhomecncServerHost;
          if (lasthost !== undefined) {
              $('#com-chilipeppr-widget-myhomecnc-host').val(lasthost);
          }
          // if connect btn or enter key on remote host connect
          var remoteCon = $('#' + this.id + '-hostbtn');
          remoteCon.click(this.onRemoteHostConnect.bind(this));

          $('#com-chilipeppr-widget-myhomecnc-host').keypress(function(event){
              //console.log("got keypress. event:", event);
              var keycode = (event.keyCode ? event.keyCode : event.which);
              if (keycode == '13'){
                  that.onRemoteHostConnect();
              }
          });
        },
        onRemoteHostConnect: function() {
          var that = this;

          var host = $('#com-chilipeppr-widget-myhomecnc-host').val();
          $('#' + this.id + '-hostconnectmsg').html(
            "Trying to connect to " +
            host + "...");

          this.sioConnect(host, function() {
            $('#' + that.id + '-hostconnectmsg').html("Last connect successful.");
          }, function() {
            $('#' + that.id + '-hostconnectmsg').html("Failed to connect to host.");
          });
        },
        
        sioConnect: function (hostname) {
          var that = this;
          
          // Connect to socket.io
          if (!hostname) {
            // see if local save is set and pull it if it is if not try localhost
            if(this.options.host_myhomecncserver !== undefined){
              hostname = this.options.myhomecncServerHost;
            } else {
              hostname = 'localhost';
            }
          }
          var fullurl;
          var namespace = "/cnc";

          fullurl = "http://" + hostname;
          // Passing through Nginx reverse proxy. Not necessary to specify any port
          /*
          if (hostname.match(/:\d+$/)) {
            fullurl = "http://" + hostname;
          } else {
            fullurl = "http://" + hostname + ":8990";
          }
          */
          console.log("myHomeCNC : Connecting to " + fullurl);

		      var sio = io.connect(fullurl + namespace, {reconnection: false});
          this.sio = sio;

          this.sio.on('connect', function (id) {
            console.log("myHomeCNC : Connected to " + fullurl + ". socket.id : " + id);
            
            that.isSioConnected = true;
            that.onSioMessage(); // Subscribe to socket messages
            that.onSioConnect(id, hostname);
            
            that.options.myhomecncServerHost = hostname;
            that.saveOptionsLocalStorage();
          });
          this.sio.on('connect_error', function (error) {
            console.log("myHomeCNC : Connection error : " + error);
            
            //that.isSioConnected = false; DISABLED FOR TESTS ONLY
            that.publishSysMsg("myHomeCNC Socket error.");
            that.setupConnection(); // require right host
          });
          this.sio.on('connect_timeout', function (timeout) {
            console.log("myHomeCNC : Connection timeout : " + timeout);
            
            that.isSioConnected = false;
            that.publishSysMsg("myHomeCNC Socket timeout.");
            that.setupConnection(); // require right host
          });
          this.sio.on('disconnect', function (reason) {
            console.log("myHomeCNC : Closing Sockets: " + this.sio + " => " + reason);
            
            that.isSioConnected = false;
            that.onSioDisconnect(reason);
          });
        },
        onSioConnect: function (id, host) {
          
          chilipeppr.publish("/" + this.id + "/sio/onconnect", id, host);
          
          this.setupPermissions();
          
          $(window).trigger('resize');
        },
        onSioDisconnect: function (reason) {
          
          chilipeppr.publish("/" + this.id + "/sio/ondisconnect", reason);
          
          this.setupConnection(null);
        },
        sioSend: function (key, msg) {
          var that = this;
          
          // to send anything down : this.sioSend(msg);
          if (this.isSioConnected) {
            this.sio.send(key, msg);
          } else {
            this.publishSysMsg("Tried to send message, but we are not connected to myHomeCNC Socket server.");
          }
        },
        
        // Subscribe to socket.io events
        onSioMessage: function () {
        var that = this;
          // to receive anything up : this.sio.on('key', function (event, data) {...}),
          // ==>HEADER
          this.sio.on('go_mode', function(event, msg) {
            $('#' + that.id + ' .cnc-mode-toolbar button').each(function() {
              $(this).removeClass('btn-primary');
            });
            $('#opt-cnc-mode' + msg.data).addClass('btn-primary');
            that.cncMode = msg.data;
          });
          
          // ==>MAIN Tab Elements
          this.sio.on('go_rpm', function(event, msg) {
            $('#' + that.id + ' .cnc-spindle-speed').text(that.formatNumber(msg.data, 5, 0));
          });
          this.sio.on('go_tof', function(event, msg) {
            $('#' + that.id + ' .cnc-absolute-distance').text(that.formatNumber(msg.data, 3, 0));
          });
          this.sio.on('go_tof_w', function(event, msg) {
            that.setLabelStatus('cnc-absolute-distance', msg.data);
          });
          this.sio.on('go_mlx_st_a', function(event, msg) {
            $('#' + that.id + ' .cnc-object-ambient-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_mlx_st', function(event, msg) {
            $('#' + that.id + ' .cnc-object-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_mlx_st_w', function(event, msg) {
            that.setLabelStatus('cnc-object-temperature', msg.data);
          });
          this.sio.on('go_mlx_lt_a', function(event, msg) {
            $('#' + that.id + ' .cnc-laser-ambient-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_mlx_lt', function(event, msg) {
            $('#' + that.id + ' .cnc-laser-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_mlx_lt_w', function(event, msg) {
            that.setLabelStatus('cnc-laser-temperature', msg.data);
          });
          this.sio.on('go_lsf', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-success');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-warning');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-default');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-warning');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-default');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-success');
            } else {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-success');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-default');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-warning');
            }  
          });
          this.sio.on('go_cls1', function(event, msg) {
            $('#' + that.id + ' .cnc-uvlaser-current').text(that.formatNumber(msg.data, 5, 3));
          });
          this.sio.on('go_cls1_w', function(event, msg) {
            that.setLabelStatus('cnc-uvlaser-current', msg.data);
          });
          this.sio.on('go_cls5', function(event, msg) {
            $('#' + that.id + ' .cnc-hplaser-current').text(that.formatNumber(msg.data, 5, 3));
          });
          this.sio.on('go_cls5_w', function(event, msg) {
            that.setLabelStatus('cnc-hplaser-current', msg.data);
          });
          this.sio.on('go_plas_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-plaser', msg.data);
          });
          this.sio.on('go_test_laser', function(event, msg) {
            that.setButtonStatus('btn-cnc-laser-test', msg.data);
          });
          // ==>LIGHT Tab Elements
          this.sio.on('go_rled', function (event, msg) {
            var r = msg.red;
            var g = msg.green;
            var b = msg.blue;
            $('#' + that.id + ' .cnc-neopixels-rgba').css('background-color', 'rgba(' + r + ',' +  g + ',' + b + ', 1)');
            $('#' + that.id + ' .btn-cnc-neopixels-newcolor').removeClass('active');
          });
          this.sio.on('go_rled_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-neopixels', msg.data);
          });
          // ==>UV BOX Tab Elements
          this.sio.on('go_uv_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-uvlight', msg.data);
          });
          this.sio.on('go_uv_buzz', function(event, msg) {
            that.setButtonStatus('btn-cnc-uvlight-buzzer', msg.data);
          });
          this.sio.on('go_uv_time', function(event, msg) {
            $('#' + that.id + ' .btn-cnc-uvlight-timeset').removeClass('active');
          });
          this.sio.on('go_uv_etime', function(event, msg) {
            $('#' + that.id + ' .cnc-uvlight-etime').text = that.formatNumber(msg.data, 3, 0);
          });
          this.sio.on('go_uv_run', function(event, msg) {
            if (msg.data == 1) {
              $('#' + that.id + ' .cnc-uvlight-timelabel').text = 'Remaining Time';
            } else {
              $('#' + that.id + ' .cnc-uvlight-timelabel').text = 'Time Set';
            }
          });
          this.sio.on('go_uv_int', function(event, msg) {
            $('#' + that.id + ' .btn-cnc-uvlight-setintensity').removeClass('active');
            //$('#' + that.id + ' .sld-cnc-uvlight-intensity').data('data-old', msg.data);
            $('#' + that.id + ' .sld-cnc-uvlight-intensity').val(msg.data).trigger('input');
          });
          
          // ==>TOOLS Tab Elements
          this.sio.on('go_vac_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-vac', msg.data);
          });
          this.sio.on('go_vac_am', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-vac1').addClass('btn-primary');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-vac2').addClass('btn-primary');
            } else if (msg.data == 2) {
              $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-vac3').addClass('btn-primary');
            }
          });
          this.sio.on('go_actool_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-actool', msg.data);
          });
          this.sio.on('go_actool_am', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-actool1').addClass('btn-primary');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-actool2').addClass('btn-primary');
            } else if (msg.data == 2) {
              $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-actool3').addClass('btn-primary');
            }
          });
          this.sio.on('go_adctool_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-dctool', msg.data);
          });
          this.sio.on('go_dctool_am', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-dctool1').addClass('btn-primary');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-dctool2').addClass('btn-primary');
            } else if (msg.data == 2) {
              $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-dctool3').addClass('btn-primary');
            }
          });
          this.sio.on('go_dctool_int', function(event, msg) {
            $('#' + that.id + ' .btn-cnc-dctool-setintensity').removeClass('active');
            //$('#' + that.id + ' .sld-cnc-dctool-intensity').data('data-old', msg.data);
            $('#' + that.id + ' .sld-cnc-dctool-intensity').val(msg.data).trigger('input');
          });
          
          this.sio.on('go_cinp', function(event, msg) {
            $('#' + that.id + ' .cnc-acin').text(that.formatNumber(msg.data, 5, 2));
          });
          this.sio.on('go_cinp_w', function(event, msg) {
            that.setLabelStatus('cnc-acin', msg.data);
          });
          this.sio.on('go_ldsh_sch', function(event, msg) {
            $('#ddl-cnc-ls-scheme li').each(function() {
              $(this).removeClass('active');
            });
            $('#' + that.id + ' .li-cnc-ls-scheme' + msg.data).addClass('active');
            var texto = $('#' + that.id + ' .li-cnc-ls-scheme' + msg.data + ' a').text();
            var a = texto.indexOf('>');
            var b = texto.lastIndexOf('>');
            $('#' + that.id + ' .cnc-ls-s1').text(texto.slice(0, 3));
            $('#' + that.id + ' .cnc-ls-s2').text(texto.slice(a+2, a+5));
            $('#' + that.id + ' .cnc-ls-s3').text(texto.slice(b+2, b+5));
          });
          this.sio.on('go_ldsh_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-ls-loadshedding', msg.data);
          });
          this.sio.on('go_ldsh_t1', function(event, msg) {
            if (msg.data == 1) {
              $('#' + that.id + ' .cnc-ls-s1').removeClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s1').addClass('btn-danger');
            } else if (msg.data == 0) {
              $('#' + that.id + ' .cnc-ls-s1').removeClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s1').addClass('btn-primary');
              $('#' + that.id + ' .btn-cnc-ls-reset').removeClass('active');
            } 
          });
          this.sio.on('go_ldsh_t2', function(event, msg) {
            if (msg.data == 1) {
              $('#' + that.id + ' .cnc-ls-s1a').removeClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s1a').addClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s2').removeClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s2').addClass('btn-danger');
            } else if (msg.data == 0) {
              $('#' + that.id + ' .cnc-ls-s1a').removeClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s1a').addClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s2').removeClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s2').addClass('btn-primary');
            } 
          });
          this.sio.on('go_ldsh_t3', function(event, msg) {
            if (msg.data == 1) {
              $('#' + that.id + ' .cnc-ls-s2a').removeClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s2a').addClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s3').removeClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s3').addClass('btn-danger');
            } else if (msg.data == 0) {
              $('#' + that.id + ' .cnc-ls-s2a').removeClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s2a').addClass('btn-primary');
              $('#' + that.id + ' .cnc-ls-s3').removeClass('btn-danger');
              $('#' + that.id + ' .cnc-ls-s3').addClass('btn-primary');
            } 
          });
          
          // ==>OFFSETS Tab Elements
          this.sio.on('go_rel', function(event, msg) {
            if (msg.data == 0) {
              that.toggleOffsetButtonGroup('btn-cnc-offset-uvlaser');
            } else if (msg.data == 1) {
              that.toggleOffsetButtonGroup('btn-cnc-offset-hplaser');
            } else if (msg.data == 2) {
              that.toggleOffsetButtonGroup('btn-cnc-offset-pen');
            } else if (msg.data == 3) {
              that.toggleOffsetButtonGroup('btn-cnc-offset-dispenser');
            } else if (msg.data == 4) {
              that.toggleOffsetButtonGroup('btn-cnc-offset-spindle');
            }
          });
          this.sio.on('go_allowz', function(event, msg) {
            that.setButtonStatus('btn-cnc-offset-allowzero', msg.data);
          });
          this.sio.on('go_pos', function(event, msg) {
            // HERE GO OFFSET POS ORDER to SPJS - First : msg.spn_x, msg.spn_y -> Second : msg.x, msg.y
          });
          
          // ==>AIR Tab Elements
          this.sio.on('go_air_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-airsystem', msg.data);
          });
          this.sio.on('go_air_am', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-airmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-airsystem1').addClass('btn-primary');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-airmode-toolbar button').each(function() {
                $(this).removeClass('btn-primary');
              });
              $('#opt-cnc-airsystem2').addClass('btn-primary');
            }
          });
          this.sio.on('go_pinlet', function(event, msg) {
            $('#' + that.id + ' .cnc-air-inletpressure').text(that.formatNumber(msg.data, 5, 3));
          });
          this.sio.on('go_pinlet_w', function(event, msg) {
            that.setLabelStatus('cnc-air-inletpressure', msg.data);
          });
          this.sio.on('go_pvv_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-air-purgevalve', msg.data);
          });
          this.sio.on('go_cp_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-air', msg.data);
          });
          this.sio.on('go_cp_av', function(event, msg) {
            if (msg.data == 0) {
              $('#' + that.id + ' .cnc-air-available').removeClass('label-success');
              $('#' + that.id + ' .cnc-air-available').addClass('label-default');
            } else if (msg.data == 1) {
              $('#' + that.id + ' .cnc-air-available').removeClass('label-default');
              $('#' + that.id + ' .cnc-air-available').addClass('label-success');
            } 
          });
          this.sio.on('go_cvv_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-air-coolingvalve', msg.data);
          });
          this.sio.on('go_dvv_onoff', function(event, msg) {
            that.setButtonStatus('btn-cnc-air-dispenservalve', msg.data);
          });
          this.sio.on('go_pcool', function(event, msg) {
            $('#' + that.id + ' .cnc-air-coolingpressure').text(that.formatNumber(msg.data, 5, 3));
          });
          this.sio.on('go_pcool_w', function(event, msg) {
            that.setLabelStatus('cnc-air-coolingpressure', msg.data);
          });
          this.sio.on('go_pdis', function(event, msg) {
            $('#' + that.id + ' .cnc-air-dispenserpressure').text(that.formatNumber(msg.data, 5, 3));
          });
          this.sio.on('go_pdis_w', function(event, msg) {
            that.setLabelStatus('cnc-air-dispenserpressure', msg.data);
          });
          this.sio.on('go_test_air', function(event, msg) {
            that.setButtonStatus('btn-cnc-test-air', msg.data);
          });
          
          // ==>CHARTS Tab Elements
          
          // ==>CNC Tab Elements
          this.sio.on('go_spjs', function(event, msg) {
            that.setSysLabelStatus('cnc-sys-spjs', msg.data);
          });
          this.sio.on('go_serial', function(event, msg) {
            that.setSysLabelStatus('cnc-sys-serial', msg.data);
          });
          this.sio.on('go_cam_s1', function(event, msg) {
            that.setSysLabelStatus('cnc-sys-cam_s1', msg.data);
          });
          this.sio.on('go_cam_s2', function(event, msg) {
            that.setSysLabelStatus('cnc-sys-cam_s2', msg.data);
          });
          this.sio.on('go_eth', function(event, msg) {
            $('#' + that.id + ' .cnc-sys-ethernet').text(msg.data);
          });
          this.sio.on('go_wifi', function(event, msg) {
            $('#' + that.id + ' .cnc-sys-wifi').text(msg.data);
          });
          this.sio.on('go_users', function(event, msg) {
            $('#' + that.id + ' .cnc-sys-socketusers').text(that.formatNumber(msg.data, 2, 0));
          });
          this.sio.on('go_mem', function(event, msg) {
            $('#' + that.id + ' .cnc-sys-memused').text(that.formatNumber(msg.data, 3, 0) + '%');
          });
          this.sio.on('go_cpu', function(event, msg) {
            $('#' + that.id + ' .cnc-sys-cpuused').text(that.formatNumber(msg.data, 3, 0) + '%');
          });
          this.sio.on('go_atd', function(event, msg) {
            $('#' + that.id + ' .cnc-driver-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_atd_w', function(event, msg) {
            that.setLabelStatus('cnc-driver-temperature', msg.data);
          });
          this.sio.on('go_atc', function(event, msg) {
            $('#' + that.id + ' .cnc-stepper-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_atc_w', function(event, msg) {
            that.setLabelStatus('cnc-stepper-temperature', msg.data);
          });
          this.sio.on('go_atp', function(event, msg) {
            $('#' + that.id + ' .cnc-power-temperature').text(that.formatNumber(msg.data, 5, 1));
          });
          this.sio.on('go_atp_w', function(event, msg) {
            that.setLabelStatus('cnc-power-temperature', msg.data);
          });
          this.sio.on('go_fan_atd', function(event, msg) {
            that.setSysLabelStatus('cnc-driver-fan', msg.data);
          });
          this.sio.on('go_fan_atc', function(event, msg) {
            that.setSysLabelStatus('cnc-stepper-fan', msg.data);
          });
          this.sio.on('go_fan_atp', function(event, msg) {
            that.setSysLabelStatus('cnc-power-fan', msg.data);
          });
          this.sio.on('go_fan_lck', function(event, msg) {
            that.setSysLabelStatus('cnc-fan-lock', msg.data);
          });
        },
        setupPermissions: function() {
          var that = this;
          
          // Enable/disable elements according to the connection and cnc status
          if (!this.isSioConnected){
            $('#' + this.id + '-main-panel').addClass('hidden');
            $('#' + this.id + '-connect-panel').removeClass('hidden');
            $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
            $('#' + this.id + ' .btn-cnc-estop').attr('disabled', 'disabled');
            $('#' + this.id + ' .btn-cnc-settings').attr('disabled', 'disabled');
            if ($('#com-chilipeppr-widget-myhomecnc-modal-settings').hasClass('in')) {
              $('#com-chilipeppr-widget-myhomecnc-modal-settings').modal('hide');
            }
          } else if (this.isSioConnected) {
            $('#' + this.id + '-connect-panel').addClass('hidden');
            $('#' + this.id + '-main-panel').removeClass('hidden');
            $('#' + this.id + ' .btn-cnc-estop').removeAttr('disabled');
            $('#' + this.id + ' .btn-cnc-settings').removeAttr('disabled');
            
            if (this.iseStopActive) {
              $('#' + this.id + ' .cnc-btn-g1').attr('disabled', 'disabled');
              $('#' + this.id + ' .cnc-btn-g2').attr('disabled', 'disabled');
              $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
            } else if (!this.iseStopActive){
              $('#' + this.id + ' .cnc-btn-g1').removeAttr('disabled');
              
              if (!this.isSPJSConnected || !this.isSerialConnected || !this.isPWMAvailable) {
                $('#' + this.id + ' .cnc-btn-g2').attr('disabled', 'disabled');
                $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
              } else if (this.isSPJSConnected && this.isSerialConnected && this.isPWMAvailable) {
                $('#' + this.id + ' .cnc-btn-g2').removeAttr('disabled');
              }
            }
            
            if (!this.iseStopActive && this.isSPJSConnected && this.isSerialConnected && this.isPWMAvailable) {
              $('#' + this.id + ' .cnc-mode-toolbar button').removeAttr('disabled');
            }
          }
        },
        
        // Charts
        setupCharts: function() {
          var that = this;
          
          // Temperature Chart
          var xxx = [65,59,88.2,81,56,55,40];
            
          Chart.defaults.global.defaultFontSize = 8;
          Chart.defaults.global.elements.line.borderWidth = 1;
          Chart.defaults.global.elements.point.radius = 1;
          this.temperatureChartConfig = {
            type: 'line',
            data: {
                  labels: ["1","2","3","4","5","6"],
                  datasets : [{
                            backgroundColor: "rgba(255,0,0,1)",
                            borderColor: "rgba(255,0,0,1)",
                            data : xxx,
                            fill: false
                            }]
                  },
                  options: {
                            responsive: false,
                            legend: false,
                            animation : false,
                            scaleOverride : false,
                            scaleSteps : 10,//Number - The number of steps in a hard coded scale
                            scaleStepWidth : 10,//Number - The value jump in the hard coded scale
                            scaleStartValue : 10,//Number - The scale starting value
                            scales: {
                                    xAxes: [{display: false}],
                                    yAxes: [{display: true}]
                                    }
                            }
                  };
          var ctx = $('#cnc-temperature-chart'); //.get(0).getContext("2d");
          var myLine = new Chart(ctx, this.temperatureChartConfig);
        },
        
        // Setup Event Listeners
        btnSetup: function() {

          // Chevron hide/show body
          var that = this;
            
          $('#' + this.id + ' .hidebody').click(function(evt) {
            console.log("myHomeCNC : hide/unhide body");
            if ($('#' + that.id + ' .panel-body').hasClass('hidden') && $('#' + that.id + ' .connect-panel-body').hasClass('hidden')) {
              // it's hidden, unhide
              that.showBody(evt);
            } else {
              // hide
              that.hideBody(evt);
            }
          });
          // Ask bootstrap to scan all the buttons in the widget to turn
          // on popover menus
          $('#' + this.id + ' .btn').popover({
            delay: 1000,
            animation: true,
            placement: "auto",
            trigger: "hover",
            container: 'body'
          });
          // same for buttons in the modal
          $('#' + this.id + '-modal-settings .btn').popover({
            delay: 1000,
            animation: true,
            placement: "auto",
            trigger: "hover",
            container: '#com-chilipeppr-widget-myhomecnc-modal-settings'
          });
          // respect min/max of a text field
          $('input[type="number"]').on('input', function() {
            if ($(this).val() > $(this).attr('max')*1) {
              $(this).val($(this).attr('max')); 
            } else if ($(this).val() < $(this).attr('min')*1) {
              $(this).val($(this).attr('min'));
            }
          });
          // Bind events to their functions
          // Event Listeners
          
          // ==> HEADER Events
          $('#' + this.id + ' .btn-cnc-estop').on('dblclick', function() { //e-Stop
          
            if (($(this).text() == "e-Stop") && !that.iseStopActive) { 
              that.toggle2Class($(this), 'btn-danger', 'btn-warning');
              $(this).text("Reset");
              that.iseStopActive = true;
            } else if (($(this).text() == "Reset") && that.iseStopActive) {
              that.toggle2Class($(this), 'btn-danger', 'btn-warning');
              $(this).text("e-Stop");
              that.iseStopActive = false;
            }
              
            that.setupPermissions();
          });
          
          // ==> MAIN Tab events
          $('#' + this.id + ' .btn-cnc-plaser').on('click', function() { //toggle Position Lasers
            that.toggleClass($(this), 'active');
            that.sioSend('gi_plas_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-test-laser').on('click', function() { //toggle Test Lasers
            that.toggleClass($(this), 'active');
            that.sioSend('gi_test_laser', 1);
          });
          
          // ==> LIGHT Tab events
          $('#' + this.id + ' .sld-cnc-neopixels-red').on('input', function() { // Red slider
            $('#' + that.id + ' .cnc-neopixels-red').text($(this).val());
            var r = $('#' + that.id + ' .sld-cnc-neopixels-red').val();
            var g = $('#' + that.id + ' .sld-cnc-neopixels-green').val();
            var b = $('#' + that.id + ' .sld-cnc-neopixels-blue').val();
            $('#' + that.id + ' .cnc-neopixels-newrgba').css('background-color', 'rgba(' + r + ',' +  g + ',' + b + ', 1)');
          });
          $('#' + this.id + ' .sld-cnc-neopixels-green').on('input', function() { // Green slider
            $('#' + that.id + ' .cnc-neopixels-green').text($(this).val());
            var r = $('#' + that.id + ' .sld-cnc-neopixels-red').val();
            var g = $('#' + that.id + ' .sld-cnc-neopixels-green').val();
            var b = $('#' + that.id + ' .sld-cnc-neopixels-blue').val();
            $('#' + that.id + ' .cnc-neopixels-newrgba').css('background-color', 'rgba(' + r + ',' +  g + ',' + b + ', 1)');
          });
          $('#' + this.id + ' .sld-cnc-neopixels-blue').on('input', function() { // Blue slider
            $('#' + that.id + ' .cnc-neopixels-blue').text($(this).val());
            var r = $('#' + that.id + ' .sld-cnc-neopixels-red').val();
            var g = $('#' + that.id + ' .sld-cnc-neopixels-green').val();
            var b = $('#' + that.id + ' .sld-cnc-neopixels-blue').val();
            $('#' + that.id + ' .cnc-neopixels-newrgba').css('background-color', 'rgba(' + r + ',' +  g + ',' + b + ', 1)');
          });
          $('#' + this.id + ' .btg-cnc-neopixels-pswhite').on('click', function() { //White color
            //$('#' + that.id + ' .sld-cnc-neopixels-red').val(255).trigger('input');
            //$('#' + that.id + ' .sld-cnc-neopixels-green').val(255).trigger('input');
            //$('#' + that.id + ' .sld-cnc-neopixels-blue').val(255).trigger('input');
            that.sioSend('gi_rled', {red: 255, green: 255, blue: 255});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-psred').on('click', function() { //Red color
            that.sioSend('gi_rled', {red: 255, green: 0, blue: 0});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-psgreen').on('click', function() { //Red color
            that.sioSend('gi_rled', {red: 0, green: 255, blue: 0});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-psblue').on('click', function() { //Blue color
            that.sioSend('gi_rled', {red: 0, green: 0, blue: 255});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-psyellow').on('click', function() { //Yellow color
            that.sioSend('gi_rled', {red: 255, green: 255, blue: 0});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-pspurple').on('click', function() { //Purple color
            that.sioSend('gi_rled', {red: 127, green: 0, blue: 127});
          });
          $('#' + this.id + ' .btg-cnc-neopixels-psorange').on('click', function() { //Orange color
            that.sioSend('gi_rled', {red: 255, green: 127, blue: 0});
          });
          $('#' + this.id + ' .btn-cnc-neopixels-newcolor').on('click', function() { //Set new color
            if ($('#' + that.id + ' .cnc-neopixels-rgba').css('background-color') != $('#' + that.id + ' .cnc-neopixels-newrgba').css('background-color')) {
              $(this).addClass('active');
              var r = $('#' + that.id + ' .sld-cnc-neopixels-red').val();
              var g = $('#' + that.id + ' .sld-cnc-neopixels-green').val();
              var b = $('#' + that.id + ' .sld-cnc-neopixels-blue').val();
              that.sioSend('gi_rled', {red: r, green: g, blue: b, bright: 1});
            }
          });
          $('#' + this.id + ' .btn-cnc-neopixels').on('click', function() { //toggle Round Led
            that.toggleClass($(this), 'active');
            that.sioSend('gi_rled_onoff', 1);
          });
          
          // ==> UV BOX Tab Events  
          $('#' + this.id + ' .sld-uvlight-intensity').on('input', function() { // UVLight Intensity Slider
            $('#' + that.id + ' .cnc-uvlight-intensity').text($(this).val() + '%');
          });
          $('#' + this.id + ' .btn-cnc-uvlight').on('click', function() { //Toggle UV Light
            that.toggleClass($(this), 'active');
            that.sioSend('gi_uv_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-uvlight').on('click', function() { //Set UV Intensity
            $(this).addClass('active');
            that.sioSend('gi_uv_int', $('#' + this.id + ' .sld-uvlight-intensity').val());
          });
          $('#' + this.id + ' .btn-cnc-uvlight-buzzer').on('click', function() { //Toggle Buzz on Complete
            that.toggleClass($(this), 'active');
            that.sioSend('gi_uv_buzz', 1);
          });
          $('#' + this.id + ' .btn-cnc-uvlight-timeset').on('click', function() { //Time Set (from input)
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              $(this).addClass('active');
              that.sioSend('gi_uv_time', $('#' + this.id + ' .inb-cnc-uvlight-newtime').val());
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time60').on('click', function() { //Time Set 60s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 60);
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time120').on('click', function() { //Time Set 120s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 120);
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time180').on('click', function() { //Time Set 180s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 180);
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time300').on('click', function() { //Time Set 300s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 300);
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time420').on('click', function() { //Time Set 420s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 420);
            }
          });
          $('#' + this.id + ' .btg-cnc-uvlight-time600').on('click', function() { //Time Set 600s
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              that.sioSend('gi_uv_time', 600);
            }
          });
          $('#' + this.id + ' .btn-cnc-uvlight-reset').on('click', function() { //Reset Timer
            if (!$('#' + this.id + ' .btn-cnc-uvlight').hasClass('active')) {
              $(this).addClass('active');
              that.sioSend('gi_uv_ack', 1);
            }
          });
          
          // ==> TOOLS Tab events
          $('#opt-cnc-vac1').on('click', function() { //VAC Mode
            $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_vac_am', 0);
          });
          $('#opt-cnc-vac2').on('click', function() { //VAC Mode
            $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_vac_am', 1);
          });
          $('#opt-cnc-vac3').on('click', function() { //VAC Mode
            $('#' + that.id + ' .cnc-vacmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_vac_am', 2);
          });
          $('#' + this.id + ' .btn-cnc-vac').on('click', function() { //toggle VAC
            that.toggleClass($(this), 'active');
            that.sioSend('gi_vac_onoff', 1);
          });
          $('#opt-cnc-actool1').on('click', function() { //ACTool Mode
            $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_actool_am', 0);
          });
          $('#opt-cnc-actool2').on('click', function() { //ACTool Mode
            $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_actool_am', 1);
          });
          $('#opt-cnc-actool3').on('click', function() { //ACTool Mode
            $('#' + that.id + ' .cnc-actoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_actool_am', 2);
          });
          $('#' + this.id + ' .btn-cnc-actool').on('click', function() { //toggle ACTool
            that.toggleClass($(this), 'active');
            that.sioSend('gi_actool_onoff', 1);
          });
          $('#opt-cnc-dctool1').on('click', function() { //DCTool Mode
            $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_dctool_am', 0);
          });
          $('#opt-cnc-dctool2').on('click', function() { //DCTool Mode
            $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_dctool_am', 1);
          });
          $('#opt-cnc-dctool3').on('click', function() { //DCTool Mode
            $('#' + that.id + ' .cnc-dctoolmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_dctool_am', 2);
          });
          $('#' + this.id + ' .btn-cnc-dctool').on('click', function() { //toggle DCTool
            that.toggleClass($(this), 'active');
            that.sioSend('gi_dctool_onoff', 1);
          });
          
          $('#' + this.id + ' .sld-dctool-intensity').on('input', function() { //DCTool Intensity slider
            $('#' + that.id + ' .cnc-dctool-intensity').text($(this).val() + '%');
          });
          $('#' + this.id + ' .btn-cnc-dctool-setintensity').on('click', function() { //Set UV Intensity
            $(this).addClass('active');
            that.sioSend('gi_dctool_int', $('#' + this.id + ' .sld-dctool-intensity').val());
          });
          $('#' + this.id + ' .btn-cnc-ls-loadshedding').on('click', function() { //toggle Load Shedding
            that.toggleClass($(this), 'active');
            that.sioSend('gi_ldsh_onoff', 1);
          });
          $('#ddl-cnc-ls-scheme li a').on('click', function() { //DDL Shutdown Sequence
            //$('#ddl-cnc-ls-scheme li').each(function() {
            //  $(this).removeClass('active');
            //});
            //$(this).closest('li').addClass('active');
            var idx = $(this).closest('li').index();
            //var texto = $(this).text();
            //var a = texto.indexOf('>');
            //var b = texto.lastIndexOf('>');
            //$('#' + that.id + ' .cnc-ls-s1').text(texto.slice(0, 3));
            //$('#' + that.id + ' .cnc-ls-s2').text(texto.slice(a+2, a+5));
            //$('#' + that.id + ' .cnc-ls-s3').text(texto.slice(b+2, b+5));
            that.sioSend('gi_ldsh_sch', idx);
          });
          $('#' + this.id + ' .btn-cnc-ls-reset').on('click', function() { //LDSH Reset
            $(this).addClass('active');
            that.sioSend('gi_ldsh_reset', 1);
          });
          
          // ==> OFFSETS Tab events
          $('#' + this.id + ' .btn-cnc-offset-uvlaser').on('click', function() { //UV Laser Offset
            $(this).addClass('active');
            that.sioSend('gi_ls1_pos', 1);
          });
          $('#' + this.id + ' .btn-cnc-offset-hplaser').on('click', function() { //HPLaser Offset
            $(this).addClass('active');
            that.sioSend('gi_ls5_pos', 1);
          });
          $('#' + this.id + ' .btn-cnc-offset-pen').on('click', function() { //Pen Offset
            $(this).addClass('active');
            that.sioSend('gi_pen_pos', 1);
          });
          $('#' + this.id + ' .btn-cnc-offset-dispenser').on('click', function() { //Dispenser Offset
            $(this).addClass('active');
            that.sioSend('gi_dis_pos', 1);
          });
          $('#' + this.id + ' .btn-cnc-offset-spindle').on('click', function() { //Spindle Offset
            $(this).addClass('active');
            that.sioSend('gi_spn_pos', 1);
          });
          $('#' + this.id + ' .btn-cnc-offset-allowzero').on('click', function() { //Allow Zeroing
            that.toggleClass($(this), 'active');
            that.sioSend('gi_allowz', 1);
          });
          
          // ==> AIR Tab events
          $('#' + this.id + ' .btn-cnc-airsystem').on('click', function() { //Toggle Air System
            that.toggleClass($(this), 'active');
            that.sioSend('gi_air_onoff', 1);
          });
          $('#opt-cnc-airsystem1').on('click', function() { //Air System Manual Mode
            $('#' + that.id + ' .cnc-airmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_air_am', 0);
          });
          $('#opt-cnc-airsystem2').on('click', function() { //Air System Auto Mode
            $('#' + that.id + ' .cnc-airmode-toolbar button').each(function() {
              $(this).removeClass('active');
              //$(this).removeClass('btn-primary');
            });
            $(this).addClass('active');
            //$(this).addClass('btn-primary')
            that.sioSend('gi_air_am', 1);
          });
          $('#' + this.id + ' .btn-cnc-air-purgevalve').on('click', function() { //Purge Valve Open/Close
            that.toggleClass($(this), 'active');
            that.sioSend('gi_pvv_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-air').on('click', function() { //Toggle Air Compressor
            that.toggleClass($(this), 'active');
            that.sioSend('gi_cp_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-air-coolingvalve').on('click', function() { //Cooling Valve Open/Close
            that.toggleClass($(this), 'active');
            that.sioSend('gi_cvv_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-air-dispenservalve').on('click', function() { //Dispenser Valve Open/Close
            that.toggleClass($(this), 'active');
            that.sioSend('gi_dvv_onoff', 1);
          });
          $('#' + this.id + ' .btn-cnc-test-air').on('click', function() { //Toggle Test Air System
            that.toggleClass($(this), 'active');
            that.sioSend('gi_test-air', 1);
          });
          
          // ==> CHARTS Tab events
          
          // ==> CNC Tab events
          $('#' + this.id + ' .btn-cnc-sys-spjs').on('dblclick', function() { //Restart SPJS
            that.sioSend('gi_spjs', 1);
          });
           $('#' + this.id + ' .btn-cnc-sys-cam-s1').on('dblclick', function() { //Restart Cam A Server (Spindle)
            that.sioSend('gi_cam_s1', 1);
          });
           $('#' + this.id + ' .btn-cnc-sys-cam-s2').on('dblclick', function() { //Restart Cam B Server (Laser)
            that.sioSend('gi_cam_s2', 1);
          });

          // ==> LOG Tab Events
          $('#' + this.id + ' .btn-cnc-log-copy').click(this.copyLog.bind(this));
          $('#' + this.id + ' .btn-cnc-log-clear').click(this.clearLog.bind(this));
          $('#' + this.id + '-modal-settings .btn-cnc-log-enable').click(this.toggleLog.bind(this));
        },

        // Publishing 
        publishSysMsg: function (msg) {
          
          chilipeppr.publish("/" + this.id + "/sys", msg);
          var now = Date.now();
          if (this.lastMsg == msg && now - this.lastMsgTime < 20000) {
            // skip publish
            console.log("myHomeCNC : skipping publish. same msg or too fast.");
          } else {
            chilipeppr.publish("/com-chilipeppr-elem-flashmsg/flashmsg", "myHomeCNC Message", msg);
            this.lastMsg = msg;
            this.lastMsgTime = now;
          }
        },
        requestChilipepprInfo: function() {
          
          chilipeppr.publish("/com-chilipeppr-widget-serialport/requestStatus"); // callback on /recvStatus
          chilipeppr.publish("/com-chilipeppr-widget-serialport/getlist"); // callback on /list
        },
        publishStatus: function () {
          
          chilipeppr.publish("/" + this.id + "/sio/connectionStatus", this.isSioConnected);
        
        },
        publishFeedback: function (key,msg) {
          
          chilipeppr.publish("/" + this.id + "/" + key, msg);
        },
        //statusWatcher: function () { // CHECK IF NEEDED
          // This method subscribes to "/sio/sys" and updates the UI with
          // the latest msg
        //  chilipeppr.subscribe("/" + this.id + "/sys", this, function (msg) {
        //    $('.net-delarre-widget-gpio-status .well.well-sm').text(msg); //???
        //  });
        //},
        
        // Logging functions
        setupLog: function() { // Init log tab
          if (this.options.myhomecncLogEnabled) {
            $('#' + this.id + ' .cnc-debug-log').removeClass('hidden');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').addClass('active');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').addClass('btn-primary');
          } else if (!this.options.myhomecncLogEnabled) {
            $('#' + this.id + ' .cnc-debug-log').addClass('hidden');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').removeClass('active');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').removeClass('btn-primary');
          }
        },
        toggleLog: function() { // Debug log btn
          if (!this.options.myhomecncLogEnabled) {
            $('#' + this.id + ' .cnc-debug-log').removeClass('hidden');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').addClass('active');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').addClass('btn-primary');
            this.options.myhomecncLogEnabled = true;
            this.saveOptionsLocalStorage();
          } else if (this.options.myhomecncLogEnabled) {
            $('#' + this.id + ' .cnc-debug-log').addClass('hidden');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').removeClass('active');
            $('#' + this.id + '-modal-settings .btn-cnc-log-enable').removeClass('btn-primary');
            this.options.myhomecncLogEnabled = false;
            this.saveOptionsLocalStorage();
          }
        },
        pubLog: function(origin, dir, key, msg) {
          var that = this;
          
          if (this.options.myhomecncLogEnabled) {
            var now = new Date();
            var mom = now.toLocaleDateString() + "-" + now.getHours() +":" + now.getMinutes() + ":" + now.getSeconds() + "-";
            if (origin == 'spjs' && dir == 'in') {
              $('#' + that.id + ' .cnc-log-container').append("<span class='cnc-log-msg cnc-red'>" + mom + "spjs<= {key: " + key + "}, data:{" + msg + "}</span>");
              console.log("<p class='cnc-red'>" + mom + "spjs< {key: " + key + " , msg: " + msg + "}</p>");
            } else if (origin == 'spjs' && dir == 'out') {
              $('#' + that.id + ' .cnc-log-container').append("<span class='cnc-log-msg cnc-purple'>" + mom + "spjs=> {key: " + key + "}, data:{" + msg + "}</span>");
            } else if (origin == 'sio' && dir == 'in') {
              $('#' + that.id + ' .cnc-log-container').append("<span class='cnc-log-msg cnc-blue'>" + mom + "socket.io<= {key: " + key + "}, data:{" + msg + "}</span>");
            } else if (origin == 'sio' && dir == 'out') {
              $('#' + that.id + ' .cnc-log-container').append("<span class='cnc-log-msg cnc-black'>" + mom + "socket.io=> {key: " + key + "}, data:{" + msg + "}</span>");
            }
          }
        },
        copyLog: function() {
          
          var $temp = $("<textarea>");
              
          $("body").append($temp);
          $('#' + this.id + ' .cnc-log-container span').each(function(){
            $temp.text($temp.text() + $(this).text() + '\r\n');
          });
              
          $temp.select();
          document.execCommand('copy');
          $temp.remove();
        },
        clearLog: function() {
          
          $('#' + this.id + ' .cnc-log-container').empty();
        },
        
        // Useful functions
        formatNumber : function (num, total_lenght, decimals) {
          
          // total_lenght includes '.' for decimals
          if (!isNaN(Number(num))) {
            var myNum = Number(num).toFixed(decimals)
            var zero = total_lenght - myNum.toString().length + 1;
            return Array(+(zero > 0 && zero)).join("0") + num;
          } else {
            return num;
          }
        },
        arrayFill : function (c, len) {
        
          // Create an array of len items filled with c char
          var arr = [];
          while (len--) {
            arr[len] = c;
          }
          return arr;
        },
        setLabelStatus : function (elclass, data) {
          $('#' + this.id + ' .'+ elclass).removeClass('label-primary');
          $('#' + this.id + ' .'+ elclass).removeClass('label-warning');
          $('#' + this.id + ' .'+ elclass).removeClass('label-danger');
          $('#' + this.id + ' .'+ elclass).removeClass('label-default');
          if (data == 0) {
            $('#' + this.id + ' .'+ elclass).addClass('label-primary');
          } else if (data == 1) {
            $('#' + this.id + ' .'+ elclass).addClass('label-warning');
          } else if (data == 2) {
            $('#' + this.id + ' .'+ elclass).addClass('label-danger');
          } else {
            $('#' + this.id + ' .'+ elclass).addClass('label-default');
          }
        },
        setButtonStatus : function (elclass, data) {
          if (data == 1) {
            $('#' + this.id + ' .'+ elclass).addClass('active');
            $('#' + this.id + ' .'+ elclass).removeClass('btn-default');
            $('#' + this.id + ' .'+ elclass).addClass('btn-primary');
          } else {
            $('#' + this.id + ' .'+ elclass).removeClass('active');
            $('#' + this.id + ' .'+ elclass).removeClass('btn-primary');
            $('#' + this.id + ' .'+ elclass).addClass('btn-default');
          }
        },
        toggle2Class : function(elclass, cla, clb) {
          
          // Toggle a class of an element given class
          if (elclass.hasClass(cla)) {
            elclass.removeClass(cla);
            elclass.addClass(clb);
          } else {
            elclass.removeClass(clb);
            elclass.addClass(cla);
          }    
        },
        toggleClass : function(elclass, cla) {
          
          // Toggle a class of an element given class
          if (elclass.hasClass(cla)) {
            elclass.removeClass(cla);
          } else {
            elclass.addClass(cla);
          }    
        },
        toggleOffsetButtonGroup : function(elclass) {
          
          $('#' + this.id + ' .btn-offset-group').removeClass('active');
          $('#' + this.id + ' .btn-offset-group').removeClass('btn-primary');
          $('#' + this.id + ' .' + elclass).addClass('active');
          $('#' + this.id + ' .' + elclass).addClass('btn-primary');
        },
        setSysLabelStatus: function(elclass, data) {
          if (data == 0) {
            $('#' + this.id + ' .'+ elclass).removeClass('label-success');
            $('#' + this.id + ' .'+ elclass).removeClass('label-danger');
            $('#' + this.id + ' .'+ elclass).addClass('label-default');
          } else if (data == 1) {
            $('#' + this.id + ' .'+ elclass).removeClass('label-default');
            $('#' + this.id + ' .'+ elclass).removeClass('label-danger');
            $('#' + this.id + ' .'+ elclass).addClass('label-success');
          } else if (data == 3) {
            $('#' + this.id + ' .'+ elclass).removeClass('label-default');
            $('#' + this.id + ' .'+ elclass).removeClass('label-success');
            $('#' + this.id + ' .'+ elclass).addClass('label-danger');
          }
        },
      
        setupBody: function() {
        	
        	var that = this;
        },
        /**
         * User options are available in this property for reference by your
         * methods. If any change is made on these options, please call
         * saveOptionsLocalStorage()
         */
        options: null,
        /**
         * Call this method on init to setup the UI by reading the user's
         * stored settings from localStorage and then adjust the UI to reflect
         * what the user wants.
         */
        setupUiFromLocalStorage: function() {

          // Read vals from localStorage. Make sure to use a unique
          // key specific to this widget so as not to overwrite other
          // widgets' options. By using this.id as the prefix of the
          // key we're safe that this will be unique.

          // Feel free to add your own keys inside the options
          // object for your own items

          var options = localStorage.getItem(this.id + '-options');

          if (options) {
            options = $.parseJSON(options);
            console.log("myHomeCNC : just evaled options: ", options);
          } else {
            options = {
                showBody: true,
                tabShowing: 1,
                customParam1: null,
                customParam2: 1.0
            };
          }

          this.options = options;
          console.log("myHomeCNC : options:", options);

          // show/hide body
          if (options.showBody) {
            this.showBody();
          } else {
            this.hideBody();
          }
        },
        /**
         * When a user changes a value that is stored as an option setting, you
         * should call this method immediately so that on next load the value
         * is correctly set.
         */
        saveOptionsLocalStorage: function() {
          // You can add your own values to this.options to store them
          // along with some of the normal stuff like showBody
          var options = this.options;

          var optionsStr = JSON.stringify(options);
          console.log("myHomeCNC : saving options:", options, "json.stringify:", optionsStr);
          // store settings to localStorage
          localStorage.setItem(this.id + '-options', optionsStr);
        },
        /**
         * Show the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we
         * know it was clicked by the user and thus we store it for the next
         * load so we can reset the user's preference. If you don't pass this
         * value in we don't store the preference because it was likely code
         * that sent in the param.
         */
        showBody: function(evt) {
          
          if (this.isSioConnected) {
            $('#' + this.id + ' .panel-body').removeClass('hidden');
          } else {
            $('#' + this.id + ' .connect-panel-body').removeClass('hidden');
          }
          
          $('#' + this.id + ' .panel-footer').removeClass('hidden');
          $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-up');
          $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-down');
          
          if (!(evt == null)) {
            this.options.showBody = true;
            this.saveOptionsLocalStorage();
          }
          // this will send an artificial event letting other widgets know to resize
          // themselves since this widget is now taking up more room since it's showing
          $(window).trigger("resize");
        },
        /**
         * Hide the body of the panel.
         * @param {jquery_event} evt - If you pass the event parameter in, we
         * know it was clicked by the user and thus we store it for the next
         * load so we can reset the user's preference. If you don't pass this
         * value in we don't store the preference because it was likely code
         * that sent in the param.
         */
        hideBody: function(evt) {
          $('#' + this.id + ' .panel-body').addClass('hidden');
          $('#' + this.id + ' .connect-panel-body').addClass('hidden');
          $('#' + this.id + ' .panel-footer').addClass('hidden');
          $('#' + this.id + ' .hidebody span').removeClass('glyphicon-chevron-up');
          $('#' + this.id + ' .hidebody span').addClass('glyphicon-chevron-down');
          if (!(evt == null)) {
            this.options.showBody = false;
            this.saveOptionsLocalStorage();
          }
          // this will send an artificial event letting other widgets know to resize
          // themselves since this widget is now taking up less room since it's hiding
          $(window).trigger("resize");
        },
        /**
         * This method loads the pubsubviewer widget which attaches to our
         * upper right corner triangle menu and generates 3 menu items like
         * Pubsub Viewer, View Standalone, and Fork Widget. It also enables
         * the modal dialog that shows the documentation for this widget.
         *
         * By using chilipeppr.load() we can ensure that the pubsubviewer widget
         * is only loaded and inlined once into the final ChiliPeppr workspace.
         * We are given back a reference to the instantiated singleton so its
         * not instantiated more than once. Then we call it's attachTo method
         * which creates the full pulldown menu for us and attaches the click
         * events.
         */
        forkSetup: function() {
          var topCssSelector = '#' + this.id;

          $(topCssSelector + ' .panel-title').popover({
            title: this.name,
            content: this.desc,
            html: true,
            delay: 1000,
            animation: true,
            trigger: 'hover',
            placement: 'auto'
          });

          var that = this;
          chilipeppr.load("http://raw.githubusercontent.com/chilipeppr/widget-pubsubviewer/master/auto-generated-widget.html", function() {
            require(['inline:com-chilipeppr-elem-pubsubviewer'], function(pubsubviewer) {
              pubsubviewer.attachTo($(topCssSelector + ' .panel-heading .dropdown-pubsub'), that);
            });
          });
        },
    }
});
