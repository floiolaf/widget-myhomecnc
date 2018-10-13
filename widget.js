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
          // ==>MAIN Tab Elements
          this.sio.on('go_rpm', function(event, data) {
            $('#' + that.id + ' .cnc-spindle-speed').text(that.formatNumber(data, 5, 0));
          });
          this.sio.on('go_tof', function(event, data) {
            $('#' + that.id + ' .cnc-absolute-distance').text(that.formatNumber(data, 3, 0));
          });
          this.sio.on('go_tof_w', function(event, data) {
            that.setLabelStatus('cnc-absolute-distance', data);
          });
          this.sio.on('go_mlx_st_a', function(event, data) {
            $('#' + that.id + ' .cnc-object-ambient-temperature').text(that.formatNumber(data, 5, 1));
          });
          this.sio.on('go_mlx_st', function(event, data) {
            $('#' + that.id + ' .cnc-object-temperature').text(that.formatNumber(data, 5, 1));
          });
          this.sio.on('go_mlx_st_w', function(event, data) {
            that.setLabelStatus('cnc-object-temperature', data);
          });
          this.sio.on('go_mlx_lt_a', function(event, data) {
            $('#' + that.id + ' .cnc-laser-ambient-temperature').text(that.formatNumber(data, 5, 1));
          });
          this.sio.on('go_mlx_lt', function(event, data) {
            $('#' + that.id + ' .cnc-laser-temperature').text(that.formatNumber(data, 5, 1));
          });
          this.sio.on('go_mlx_lt_w', function(event, data) {
            that.setLabelStatus('cnc-laser-temperature', data);
          });
          this.sio.on('go_lsf', function(event, data) {
            if (data == 0) {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-success');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-default');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-primary');
            } else if (data == 1) {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-primary');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-default');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-success');
            } else {
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-success');
              $('#' + that.id + ' .cnc-laser-onfocus').removeClass('label-primary');
              $('#' + that.id + ' .cnc-laser-onfocus').addClass('label-default');
            }  
          });
          this.sio.on('go_cls1', function(event, data) {
            $('#' + that.id + ' .cnc-uvlaser_current').text(that.formatNumber(data, 5, 3));
          });
          this.sio.on('go_cls1_w', function(event, data) {
            that.setLabelStatus('cnc-uvlaser_current', data);
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
          } else {
            $('#' + this.id + '-connect-panel').addClass('hidden');
            $('#' + this.id + '-main-panel').removeClass('hidden');
            $('#' + this.id + ' .btn-cnc-estop').removeAttr('disabled');
            $('#' + this.id + ' .btn-cnc-settings').removeAttr('disabled');
            
            if (this.iseStopActive) {
              $('#' + this.id + ' .cnc-btn-g1 button').attr('disabled', 'disabled');
              $('#' + this.id + ' .cnc-btn-g2 button').attr('disabled', 'disabled');
              $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
            } else if (!this.iseStopActive){
              $('#' + this.id + ' .cnc-btn-g1 button').removeAttr('disabled');
            }
            if (!this.isSPJSConnected || !this.isSerialConnected || !this.isPWMAvailable) {
              $('#' + this.id + ' .cnc-btn-g2 button').attr('disabled', 'disabled');
              $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
            } else if (this.isSPJSConnected && this.isSerialConnected && this.isPWMAvailable) {
              $('#' + this.id + ' .cnc-btn-g2 button').attr('disabled', 'disabled');
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

          // Bind events to their functions
          $('#' + this.id + ' .btn-cnc-log-copy').click(this.copyLog.bind(this));
          $('#' + this.id + ' .btn-cnc-log-clear').click(this.clearLog.bind(this));
          $('#' + this.id + '-modal-settings .btn-cnc-log-enable').click(this.toggleLog.bind(this));

          // Event Listeners
          $('#' + this.id + ' .btn-cnc-estop').dblclick(function() { //e-Stop
          
            that.toggleClass('btn-cnc-estop', 'btn-danger', 'btn-warning');
          
            if ($('#' + that.id + ' .btn-cnc-estop').text() == ("e-Stop")) { 
              $('#' + that.id + ' .btn-cnc-estop').text("Reset");
              that.iseStopActive = true;
            } else {
              $('#' + that.id + ' .btn-cnc-estop').text("e-Stop");
              that.iseStopActive = false;
            }
              
            that.setupPermissions();
          });
            
          $('#' + this.id + ' .sld-uvlight-intensity').on('input', function() { // UVLight slider
            //$('#' + that.id + ' .cnc-uvlight-intensity').text(that.formatNumber($('#' + that.id + ' .sld-uvlight-intensity').val(), 3, 0) + '%');
            $('#' + that.id + ' .cnc-uvlight-intensity').text($('#' + that.id + ' .sld-uvlight-intensity').val() + '%');
          });
            
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
          $('#' + this.id + ' .' + elclass).removeClass('label-primary');
          $('#' + this.id + ' .' + elclass).removeClass('label-warning');
          $('#' + this.id + ' .' + elclass).removeClass('label-danger');
          $('#' + this.id + ' .' + elclass).removeClass('label-default');
          if (data == 0) {
            $('#' + this.id + ' .' + elclass).addClass('label-primary');
          } else if (data == 1) {
            $('#' + this.id + ' .' + elclass).addClass('label-warning');
          } else if (data == 2) {
            $('#' + this.id + ' .' + elclass).addClass('label-danger');
          } else {
            $('#' + this.id + ' .' + elclass).addClass('label-default');
          }
        },
        toggleClass : function(elclass, cla, clb) {
          
          // Toggle a class of an element given class
          if ($('#' + this.id + ' .' + elclass).hasClass(cla)) {
            $('#' + this.id + ' .' + elclass).removeClass(cla);
            $('#' + this.id + ' .' + elclass).addClass(clb);
          } else {
            $('#' + this.id + ' .' + elclass).removeClass(clb);
            $('#' + this.id + ' .' + elclass).addClass(cla);
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
