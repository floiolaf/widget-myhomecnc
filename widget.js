/* global requirejs cprequire cpdefine chilipeppr THREE */
// Defining the globals above helps Cloud9 not show warnings for those variables

// ChiliPeppr Widget/Element Javascript

requirejs.config({
    /*
    Dependencies can be defined here. ChiliPeppr uses require.js so
    please refer to http://requirejs.org/docs/api.html for info.

    Most widgets will not need to define Javascript dependencies.

    Make sure all URLs are https and http accessible. Try to use URLs
    that start with // rather than http:// or https:// so they simply
    use whatever method the main page uses.

    Also, please make sure you are not loading dependencies from different
    URLs that other widgets may already load like jquery, bootstrap,
    three.js, etc.

    You may slingshot content through ChiliPeppr's proxy URL if you desire
    to enable SSL for non-SSL URL's. ChiliPeppr's SSL URL is
    https://i2dcui.appspot.com which is the SSL equivalent for
    http://chilipeppr.com
    */
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
              External modules used : Socket.io, Chart.js and Bootstrap Slider", // A description of what your widget does
        url: "(auto fill by runme.js)",       // The final URL of the working widget as a single HTML file with CSS and Javascript inlined. You can let runme.js auto fill this if you are using Cloud9.
        fiddleurl: "(auto fill by runme.js)", // The edit URL. This can be auto-filled by runme.js in Cloud9 if you'd like, or just define it on your own to help people know where they can edit/fork your widget
        githuburl: "(auto fill by runme.js)", // The backing github repo
        testurl: "(auto fill by runme.js)",   // The standalone working widget so can view it working by itself
        /**
         * Define pubsub signals below. These are basically ChiliPeppr's event system.
         * ChiliPeppr uses amplify.js's pubsub system so please refer to docs at
         * http://amplifyjs.com/api/pubsub/
         */
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
        /**
         * All widgets should have an init method. It should be run by the
         * instantiating code like a workspace or a different widget.
         */
        init: function(host) {

          console.log("myHomeCNC : I am being initted. Thanks.");

          this.forkSetup();

          // setup onconnect pubsub event for foreign signal from SPJS
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/ws/onconnect", this, function (msg) {
            this.isSPJSConnected = true;
            this.toolbarScheme();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/ws/ondisconnect", this, function (msg) {
            this.isSPJSConnected = false;
            this.toolbarScheme();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/recvStatus", this, function (msg) {
            // payload => '{"connected":true, "Websocket": ws } or {"connected":false, "websocket":null}
            if (msg.connected) {
              this.isSPJSConnected = true;
            } else {
              this.isSPJSConnected = false;
            }
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onportopen", this, function (msg) {
            // message OK = payload => 
            this.isSerialConnected = true;
            this.toolbarScheme();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onportclose", this, function (msg) {
            // message OK = payload =>
            this.isSerialConnected = false;
            this.toolbarScheme();
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/list", this, function (msg) {
            // payload => '' serial ports available + connected state
            if (msg.connected) {
              this.isSerialConnected = true;
            } else {
              this.isSerialConnected = false;
            }
          });
          chilipeppr.subscribe("/com-chilipeppr-widget-serialport/onComplete", this, function (msg) {
            // message OK = payload => '{"Id":"123"}'
          });

          this.getSPJSinfo();
          
          /* Foreign publish
          /com-chilipeppr-widget-serialport/jsonSend => {"D": "G0 X1 ", "Id":"123"} callback on /onQueue, /onWrite, /onComplete
          /com-chilipeppr-widget-serialport/send => "G1 X10 F500\n" to send Gcode to default port
          */

          // setup low-level send pubsub event
          // this is when any widget sends wants to send data data to the socket
          chilipeppr.subscribe("/" + this.id + "/send", this, function (key, msg) {
            this.wsSend(key, msg);
          });
          chilipeppr.subscribe("/" + this.id + "/getstatus", this, function () {
            this.publishStatus();
          });
          chilipeppr.subscribe("/" + this.id + "/getfeedback", this, function (key) {
            //this.publishFeedback(key, msg);
          });
          

          this.setupUiFromLocalStorage();

          this.setupBody();
          
          this.isSioConnected = false;

          this.sioConnect(host);

          this.btnSetup();

          this.cncChartTest(); // CHECK afterwards
          
          

          console.log("myHomeCNC : I am done being initted.");
        },
        setupConnection: function () {
          var that = this;

          this.connectPanelScheme();
          this.toolbarScheme();

          // show last remote host, if there is one
          var lasthost = this.options.host_myhomecncserver;
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
        // Connect
        sioConnect: function (hostname) {
          //if (!window["WebSocket"]) {
          //  this.publishSysMsg("Your browser does not support WebSockets.");
          //}
          if (!hostname) {
            // see if local save is set and pull it if it is if not try localhost
            if(this.options.host_myhomecncserver !== undefined){
              hostname = this.options.host_myhomecncserver;
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
          var that = this;

		  var sio = io.connect(fullurl + namespace, {reconnection: false});
          this.sio = sio;

          this.sio.on('connect', function (id) {
            console.log("myHomeCNC : Connected to " + fullurl + ". socket.id : " + id);
            that.isSioConnected = true;
            that.onSioMessage(); // Update event triggers
            that.onSioConnect(id, hostname);
            that.options.host_myhomecncserver = hostname;
            that.saveOptionsLocalStorage();
          });
          this.sio.on('connect_error', function (error) {
            console.log("myHomeCNC : Connection error : " + error);
            that.publishSysMsg("myHomeCNC Socket error.");
            that.setupConnection(); // require right host
          });
          this.sio.on('connect_timeout', function (timeout) {
            console.log("myHomeCNC : Connection timeout : " + timeout);
            that.publishSysMsg("myHomeCNC Socket timeout.");
            that.setupConnection(); // require right host
          });
          this.sio.on('disconnect', function (reason) {
            console.log("myHomeCNC : Closing Sockets: " + this.sio + " => " + reason);
            that.isSioConnected = false;
            that.onSioDisconnect(reason);
          });
        },
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
        onSioConnect: function (id, host) {
          chilipeppr.publish("/" + this.id + "/sio/onconnect", "connected", host, id);
          
          this.connectPanelScheme();
          this.toolbarScheme();
          
          // because we're hiding a large mess of text, we should trigger
          // a resize to make sure other widgets reflow since the scroll bar
          // or other stuff may need repositioned
          $(window).trigger('resize');
        },
        onSioDisconnect: function (reason) {
          chilipeppr.publish("/" + this.id + "/sio/ondisconnect", "disconnected");
          this.setupConnection(null);
        },
        publishStatus: function () {
          if (this.isSioConnected) {
            chilipeppr.publish("/" + this.id + "/sio/status", "connected");
          } else{
            chilipeppr.publish("/" + this.id + "/sio/status", "disconnected");
          }
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
        sioSend: function (msg) {
          if (this.isSioConnected) {
            this.sio.send(msg);
          } else {
            this.publishSysMsg("Tried to send message, but we are not connected to myHomeCNC Socket server.");
          }
        },
        sioDisconnect: function () {
          try {
            this.sio.disconnect();
          }
          catch (error) {
              console.log("myHomeCNC : Disconnect Sockets error : " + error);
          }
        },
        // to send anything down : this.sioSend(msg);
        // to receive anything up : this.sio.on('key', function (event, data) {...}),
        onSioMessage: function () {
          
        },
        connectPanelScheme: function () {
          if (this.isSioConnected) {
             $('#' + this.id + '-connect-panel').addClass('hidden');
             $('#' + this.id + '-main-panel').removeClass('hidden');
          } else {
             $('#' + this.id + '-main-panel').addClass('hidden');
             $('#' + this.id + '-connect-panel').removeClass('hidden');
             
             if ($('#com-chilipeppr-widget-myhomecnc-modal-settings').hasClass('in')) {
                $('#com-chilipeppr-widget-myhomecnc-modal-settings').modal('hide');
             }
          }
        },
        toolbarScheme: function() {
          if (this.isSPJSCOnnected && this.isSerialConnected && this.isSioConnected) {
             $('#' + this.id + ' .cnc-mode-toolbar button').removeAttr('disabled'); // or try addClass/removeClass display-only
             $('#' + this.id + ' .btn-cnc-estop').removeAttr('disabled');
             $('#' + this.id + ' .btn-cnc-settings').removeAttr('disabled');
          } else {
             $('#' + this.id + ' .cnc-mode-toolbar button').attr('disabled', 'disabled');
             $('#' + this.id + ' .btn-cnc-estop').attr('disabled');
             $('#' + this.id + ' .btn-cnc-settings').attr('disabled');
          }
        },
        getSPJSinfo: function() {
          // /com-chilipeppr-widget-serialport/requestStatus => callback on /recvStatus
          // /com-chilipeppr-widget-serialport/getlist => callback on /list
          chilipeppr.publish("/com-chilipeppr-widget-serialport/requestStatus")
          chilipeppr.publish("/com-chilipeppr-widget-serialport/getlist")
        },
        // total_lenght includes '.' for decimals
        formatNumber : function (num, total_lenght, decimals) {
          if ((typeof num) == "number") {
            var myNum = num.toFixed(decimals)
            var zero = total_lenght - myNum.toString().length + 1;
            return Array(+(zero > 0 && zero)).join("0") + num;
          } else {
            return num;
          }
        },


        /**
         * Call this method from init to setup all the buttons when this widget
         * is first loaded. This basically attaches click events to your
         * buttons. It also turns on all the bootstrap popovers by scanning
         * the entire DOM of the widget.
         */
        btnSetup: function() {

            // Chevron hide/show body
            var that = this;
            $('#' + this.id + ' .hidebody').click(function(evt) {
                console.log("myHomeCNC : hide/unhide body");
                if ($('#' + that.id + ' .panel-body').hasClass('hidden')) {
                    // it's hidden, unhide
                    that.showBody(evt);
                }
                else {
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

            // Init Say Hello Button on Main Toolbar
            // We are inlining an anonymous method as the callback here
            // as opposed to a full callback method in the Hello Word 2
            // example further below. Notice we have to use "that" so
            // that the this is set correctly inside the anonymous method
            $('#' + this.id + ' .btn-sayhello').click(function() {
                console.log("saying hello");
                // Make sure popover is immediately hidden
                $('#' + that.id + ' .btn-sayhello').popover("hide");
                // Show a flash msg
                chilipeppr.publish(
                    "/com-chilipeppr-elem-flashmsg/flashmsg",
                    "Hello Title",
                    "Hello World from widget " + that.id,
                    1000
                );
            });
            // Init Hello World 2 button on Tab 1. Notice the use
            // of the slick .bind(this) technique to correctly set "this"
            // when the callback is called
            $('#' + this.id + ' .btn-cnc-estop').dblclick(this.onEStopBtnDblClick.bind(this));

        },
        // Create an array of len items filled with c char
        arrayFill : function (c, len) {
          var arr = [];
          while (len--) {
            arr[len] = c;
          }
          return arr;
        },
        // Object Temperature Chart
        cncChartTest: function() {

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
        /**
         * onHelloBtnClick is an example of a button click event callback
         */
        onEStopBtnDblClick: function(evt) {
            if ($('#' + this.id + '-connect-panel').hasClass('hidden')) {
                $('#' + this.id + '-main-panel').addClass('hidden');
                $('#' + this.id + '-connect-panel').removeClass('hidden');
            } else {
                $('#' + this.id + '-connect-panel').addClass('hidden');
                $('#' + this.id + '-main-panel').removeClass('hidden');
                $('#' + this.id + ' .btn-cnc-estop').addClass('btn-danger');
            }
            if ($('#' + this.id + ' .btn-cnc-estop').hasClass('btn-danger')) { // Activate e-Stop
                $('#' + this.id + ' .btn-cnc-estop').removeClass('btn-danger');
                $('#' + this.id + ' .btn-cnc-estop').addClass('btn-success');
                $('#' + this.id + ' .btn-cnc-estop').text("Reset");
                // Actions for e-Stop activation
            } else {
                $('#' + this.id + ' .btn-cnc-estop').removeClass('btn-success');
                $('#' + this.id + ' .btn-cnc-estop').addClass('btn-danger');
                $('#' + this.id + ' .btn-cnc-estop').text("e-Stop");
                // Actions for Reset e-Stop
            }    
            
        },
        setupBody: function() {
        	
        	var that = this;
        	
          $("#com-chilipeppr-widget-xbox-settings-container > .cnc-slider").each(function(){
            if ( this.id == 'com-chilipeppr-widget-xbox-incjog' ) {
        	     $(this).prev('span').text( this.value / 10 )
        	  } else {
               $(this).prev('span').text(this.value)
        	  }
          });
        	
        	$('#com-chilipeppr-widget-xbox-settings-container > .cnc-slider').on("input", function(e) {
        	    if ( e.target.id == 'com-chilipeppr-widget-xbox-incjog' ) {
        	        $(e.target).prev('span').text( $(e.target).val() / 10 )
        	    } else {
                    $(e.target).prev('span').text( $(e.target).val() )
        	    }
            });
            
            $('#com-chilipeppr-widget-xbox-settings-container > .cnc-slider').on("change", function(e) {
                that.options.Deadzone = $('#com-chilipeppr-widget-xbox-deadzone').val();
                that.options.RateXY = $('#com-chilipeppr-widget-xbox-ratexy').val();
                that.options.RateZ = $('#com-chilipeppr-widget-xbox-ratez').val();
                that.options.IncJog = $('#com-chilipeppr-widget-xbox-incjog').val();
                that.options.RPM = $('#com-chilipeppr-widget-xbox-rpm').val();
                that.saveOptionsLocalStorage();
            });
			
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
            }
            else {
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
            }
            else {
                this.hideBody();
            }
            
            $('#com-chilipeppr-widget-xbox-deadzone').val(options.Deadzone);
            $('#com-chilipeppr-widget-xbox-ratexy').val(options.RateXY);
            $('#com-chilipeppr-widget-xbox-ratez').val(options.RateZ);
            $('#com-chilipeppr-widget-xbox-incjog').val(options.IncJog);
            $('#com-chilipeppr-widget-xbox-rpm').val(options.RPM);

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
            $('#' + this.id + ' .panel-body').removeClass('hidden');
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
