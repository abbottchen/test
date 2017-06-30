// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=9;
    var device = null;

    var	FrameStep=0;
    var FrameBuf= new Uint8Array(100);
    var DataLen=0;
	
    var inputs = {
        'D1': 0,
        'D2': 0,
        'D3': 0,
        'D4': 0,
        'D5': 0,
        'D6': 0,
        'A1': 0,
        'A2': 0,
        'A3': 0
    };
	
   var VarDigitIoPortMode = {
        'D1': 0,
        'D2': 0,
        'D3': 0,
        'D4': 0,
        'D5': 0,
        'D6': 0
   };
  var VarDigitIoPortLevel = {
        'D1': 0,
        'D2': 0,
        'D3': 0,
        'D4': 0,
        'D5': 0,
        'D6': 0
   };
	
   var VarAnalogOutPortPeriod = {
        'PWM1': 0,
        'PWM2': 0
   };
	
   var VarAnalogOutPortWidth = {
        'PWM1': 0,
        'PWM2': 0
   };

  function SetDigitIoPortToFrame(prm){	
	var tmp=0x00;		//mode   
	if(prm['D1'])
		tmp=tmp|(1<<0);
	   
	if(prm['D2'])
		tmp=tmp|(1<<1);
	 
	if(prm['D3'])
		tmp=tmp|(1<<2);
	  
	if(prm['D4'])
		tmp=tmp|(1<<3);
	  
	if(prm['D5'])
		tmp=tmp|(1<<4);
	  
	if(prm['D6'])
		tmp=tmp|(1<<5);
	 return tmp;
  }	
	
   function SendFrameToUart(){
	var txbuf = new Uint8Array([0xaa, 0x02, 0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x10,0x11,0x12,0x13,0x14]);	
	txbuf[0]=0xaa;
	txbuf[1]=0x0a|0x10;   
	txbuf[2]=SetDigitIoPortToFrame(VarDigitIoPortMode);
	txbuf[3]=SetDigitIoPortToFrame(VarDigitIoPortLevel);	
	txbuf[4]=VarAnalogOutPortPeriod['PWM1']%256;		//pwm1
	txbuf[5]=VarAnalogOutPortPeriod['PWM1']/256;
	txbuf[6]=VarAnalogOutPortWidth['PWM1']%256;
	txbuf[7]=VarAnalogOutPortWidth['PWM1']/256;
	txbuf[8]=VarAnalogOutPortPeriod['PWM2']%256;		//pwm2
	txbuf[9]=VarAnalogOutPortPeriod['PWM2']/256;
	txbuf[10]=VarAnalogOutPortWidth['PWM2']%256;   
	txbuf[11]=VarAnalogOutPortWidth['PWM2']/256;
	   
	var Sum=0;
	for(var i=0;i<12;i++){	
	  Sum=Sum+txbuf[i];
	}
	txbuf[12]=Sum%256; 	
	txbuf[13]=0x16;
	
	console.log('device send'+txbuf.buffer);
	for(var i=0;i<14;i++)
	{
		console.log(txbuf[i]);
		device.send(new Uint8Array([txbuf[i]]).buffer);
	}	
    }
	
    //设置工作模式
    function SetDigitIoPortMode(which,mode) {
	if(mode=='输出')
        	VarDigitIoPortMode[which]=1; 
	else
		VarDigitIoPortMode[which]=0; 
	SendFrameToUart();    
    }
    ext.SetDigitPortMode = function(which,mode) { return SetDigitIoPortMode(which,mode); };
	
   function SetDigitIoPortLevel(which,level) {
	if(level=='高')
        	VarDigitIoPortLevel[which]=1; 
	else
		VarDigitIoPortLevel[which]=0; 
	SendFrameToUart();  
    }
   ext.SetDigitPortLevel = function(level,which) { return SetDigitIoPortLevel(which,level); };	

   function SetPWMToPram(period,width,ch){ 
	period=period*1000;
	Math.round(period);
	if(period>65535)
	 	period=65535;
	else if(period<0)
		period=0;
	   
	var tmp=period*width/100;
	tmp=Math.round(tmp); 
	      
	console.log('period:'+period);   
	console.log('Width:'+tmp);   
	
	VarAnalogOutPortPeriod[ch]=period;
	VarAnalogOutPortWidth[ch]=tmp;
	SendFrameToUart();  
   };
   ext.SetPWMPram=function(period,width,ch) { return SetPWMToPram(period,width,ch); };
	
    function getSensor(which) {
        return inputs[which];
    }
    ext.sensor = function(width) { return getSensor(which); };	
	
    function getSensorFromFrame(Frame){
	inputs['D1']=(Frame[2]>>0)&0x01;
	inputs['D2']=(Frame[2]>>1)&0x01;    
    	inputs['D3']=(Frame[2]>>2)&0x01;
	inputs['D4']=(Frame[2]>>3)&0x01;
	inputs['D5']=(Frame[2]>>4)&0x01;
	inputs['D6']=(Frame[2]>>5)&0x01;
	    
	var tmp=0;
	tmp=Frame[3]+(Frame[6]&0x03)*256; 
	inputs['A1']= (100 * tmp) / 1023;
	
	tmp=Frame[4]+((Frame[6]>>2)&0x03)*256;     
	inputs['A2']= (100 * tmp) / 1023;
	   
	tmp=Frame[5]+((Frame[6]>>4)&0x03)*256;     
	inputs['A3']= (100 * tmp) / 1023;
    }
	
    function GetFrame(ch) {
	 //AA 95 4F FE FE FE BF 47 16
	 if(FrameStep>280)
		FrameStep=0; 
	//等待接收帧头    
        if(FrameStep==0){
		if(ch==0xaa){
			FrameStep=1;
			FrameBuf[0]=ch;
		}
	}
	//接收数据长度
	else if(FrameStep==1){  
	    	DataLen=ch&0x0f;
	    	FrameStep=2;
	    	FrameBuf[1]=ch;
	}
	else if((FrameStep>=2)&&(FrameStep<(2+DataLen))){
		FrameBuf[FrameStep]=ch;
		FrameStep++;
	}
	else if(FrameStep==(2+DataLen)){
		FrameBuf[FrameStep]=ch;
		
		var Sum=0;
		for(var i=0;i<(2+DataLen);i++){	
			Sum=Sum+FrameBuf[i];
		}
		Sum=Sum%256;
		//console.log('Sum: ' + Sum);
		//console.log('ch: ' + ch);
		if(ch!=Sum)
		{
			FrameStep=0;
			DataLen=0;
			console.log('累加和错误'+Sum);
		}
		else
		{
			FrameStep++;
		}
	}
	else if(FrameStep==(3+DataLen)){ 
		FrameBuf[FrameStep]=ch;
	    	if(ch==0x16){
			clearTimeout(watchdog); 
            		watchdog = null;
			getSensorFromFrame(FrameBuf);
	    	}
	        else{
			console.log('结束符错误'+ch);
		}
		FrameStep=0;
		DataLen=0;
	}
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);
        if (!device) {
            tryNextDevice();
        }
    }

    var watchdog = null;
    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;

        device.open({ stopBits: 0, bitRate: 57600, parityBit:0, ctsFlowControl: 0 });
        device.set_receive_handler(function(data) {
	    var rawData = new Uint8Array(data);	
	    //console.log('Received size' + data.byteLength);	
            //放置接收的数据到环形缓冲区
            for(var i=0;i<data.byteLength;i++)
            {
		//console.log(rawData[i]);
		GetFrame(rawData[i]);  
            }
        });

        watchdog = setTimeout(function() {
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 500);
    };
	
    ext.resetAll = function(){};	

    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        //if(!device) return {status: 1, msg: 'ScratchMiniBoard disconnected'};
        //if(watchdog) return {status: 1, msg: 'Probing for ScratchMiniBoard'};
        return {status: 2, msg: 'ScratchMiniBoard connected'};
    }
    /******************************************************/
    var cacheDuration = 1800000 //ms, 30 minutes
    var cachedTemps = {};

    function getWeatherDataFromJSOP(type , weatherData) {
    	var val = null;
    	//console.log('温度:'+weatherData.main.temp);  
    	//console.log('湿度:'+weatherData.main.humidity);
    	//console.log('风速:'+weatherData.wind.speed);
	//console.log('大气压:'+weatherData.main.pressure);
    	switch (type) {
      	case '温度':
       	 	val = weatherData.main.temp;			//单位：摄氏度
        break;
      	case '湿度':
        	val = weatherData.main.humidity;
        break;
      	case '风速':
        	val = weatherData.wind.speed;			//单位m/
        break;
	case '大气压':
        	val = weatherData.main.pressure/10;		// 单位kPa
        break;
	case '经度':
        	val = weatherData.coord.lon;
	break;
	case '纬度':
        	val = weatherData.coord.lat;
	break;			
   	}
	//console.log('getWeatherDataFromJSOP'+val);  
    	return val;
  }
    
     function fetchWeatherData(APPID,location,callback) {
    	if (location in cachedTemps &&
        	Date.now() - cachedTemps[location].time < cacheDuration) {
      		//Weather data is cached
		console.log('取缓冲区:'+cachedTemps[location].data); 
      		callback(cachedTemps[location].data);
		return;
    	}
    	// Make an AJAX call to the Open Weather Maps API
    	$.ajax({ 
      		url: 'http://api.openweathermap.org/data/2.5/weather',
     		 data: {q: location, units: 'metric', appid:APPID},
      		dataType: 'jsonp',
      		success: function(weatherData) {
		console.log('ajax返回数据:'+weatherData); 	
        	//Received the weather data. Cache and return the data.
        	cachedTemps[location] = {data: weatherData, time: Date.now()};
		callback(weatherData);	
      		}
    	});
     }
    
  ext.getWeather = function(APPID,location, type, callback) {
    fetchWeatherData(APPID,location, function(data) {
      	var val = getWeatherDataFromJSOP(type,data);
      	callback(val);
    });
  };
/******************************************************/ 
/******************************************************/  
function fetchLeiweiData(appid, callback) {
    	// Make an AJAX call to the Open Weather Maps API
    	$.ajax({ 
      		url: 'http://www.lewei50.com/api/V1/user/getSensorsWithGateway',
     		data: {userkey: appid},
     		type: 'GET',
     		dataType: 'jsonp',
      		success: function(LeiweiData) {
			console.log('ajax返回数据:'+LeiweiData); 
			callback(LeiweiData);
      		}
    	});
}    

	
function GetLeiweiDevice(json , device) {
	for(var i=0;i<json.length;i++){
		console.log('设备名称:'+json[i].name);
		if(json[i].name==device){
			return json[i];
		}
	}
	return null;
 }

function GetLeiweiSensor(json , sensorname) {
	for(var i=0;i<json.sensors.length;i++){
		console.log('传感器名称:'+json.sensors[i].name);
		if(json.sensors[i].name==sensorname){
			return json.sensors[i];
		}
	}
	return null;
 }
/*
function GetLeiweiControl(json , sensorname) {
	for(var i=0;i<json.controllers.length;i++){
		console.log('控制器名称:'+json.controllers[i].name);
		if(json.controllers[i].name==sensorname){
			return json.controllers[i];
		}
	}
	return null;
 }*/
	
  ext.GetLewei = function(appid , device, sensortype, sensorname,callback) {
    fetchLeiweiData(appid, function(data) { 
	  var jsondevice=GetLeiweiDevice(data,device);
	  if(null==jsondevice){
		callback(null);
		return;
	  }
	  var jsonSensor= GetLeiweiSensor(jsondevice,sensorname)
	  if(null==jsonSensor){
		callback(null);
		return;
	  }
	  var val=jsonSensor.value;
      	callback(val);
    });
  };
	
       /******************************************************/	
var Request = {
    // 生成时间戳
    now : function(){
        return (new Date()).getTime();
    },
    // 数据转化成url
    parseData : function(data){
        var str = "";
        if(typeof data === "string"){
            str = data;
        }else{
            // json格式
            for(var key in data){
                str += "&" + key + "=" + encodeURIComponent(data[key]);
            }
        }
        // 加时间戳，防止缓存
        str += "&_time=" + this.now();
        str = str.substr(1);
        return str;
    },
    // 创建XHR实例。
    createXhr: function(){
        var xhrhttp = null;
        if(window.XMLHttpRequest){
            xhrhttp = new XMLHttpRequest();
        }else{
            xhrhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }
        return xhrhttp;
    },
    // 异步请求
    ajax: function(opt){
        var opts = opt || {},
            url = opts.url || "",
            type = (opts.type || "get").toLowerCase(),
            async = opts.async || true,
            //params = this.parseData(opts.data),
            params=opts.data,
            sendstr = null;

        if(type == "get"){
            url = url + "?=" + params;
        }else{
            sendstr = params;
        }

        var xhr = this.createXhr();
        xhr.open(type, url, async);
        // 监听状态改变并触发事件。
        xhr.onreadystatechange = function(){
            // 当请求状态readyState 等于 4 且服务器http状态码为 200 时，表示响应已就绪：
            if(xhr.readyState == 4){
                if(xhr.status == 200){
                    opts.success && opts.success(xhr.responseText);
                }else{
                    opts.error && opts.error(xhr.status);
                }
            }
        };
        // POST需要设置请求头部
        if(type == "post"){
            //xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
            xhr.setRequestHeader("Content-Type","text");
            //xhr.setRequestHeader("&userkey=da34db80af9c46669159fe8982bbdbe0&",""); 
        }
        // get请求，sendstr = null;
        xhr.send(sendstr);
    },
    // 删除节点
    removeElement: function(ele){
        var parent = ele.parentNode;
        if(parent && parent.nodeType == 1){
            parent.removeChild(ele);
        }
    },
    // 跨域jsonp请求
    jsonp: function (url, data, funs){
        var backname;

        url += (url.indexOf("?") == -1 ? "?" : "&") + this.parseData(data);

        var match = url.match(/callback=(\w+)/);

        if(match && match[1]){
            backname = match[1];
        }else{
            //如果未定义函数名,则随机成一个函数名
            backname = "jsonp_" + this.now();

            // 传入callback
            url += "&callback=" + backname;
        }

        var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;

        // 远程回调函数，设置成全局可调用。
        window[backname] = function(data){
            // 执行后销毁，
            window[backname] = undefined;
            // 删除生成的script标签，防止污染DOM
            Request.removeElement(script);
            // 执行回调。
            funs(data);
        };
        // 在head里面插入script元素
        document.head.appendChild(script);
    }
};	

ext.SetLewei = function(appid , device, sensortype, sensorname, json) {
   Request.ajax({
	url: "http://06fe8ce61ee9424f9714880b8ee163ee-cn-hangzhou.alicloudapi.com/SetSensorData/da34db80af9c46669159fe8982bbdbe0/01",
    	type: "post",
    	data: '[{"Name":"Humidity","Value":"'+json+'"}]',
    	async: true,
	//console.log('[{"Name":"Humidity","Value":"'+json+'"}]'); 	
    	success: function(res){
    	},
    	error: function(ex){
    	alert("error"+ex)
    	}
});	
};

	
/******************************************************/
    var descriptor = {
        blocks: [
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'SetDigitPortMode', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'SetDigitPortLevel', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚采样值', 'sensor', 'A1'],
            [' ', '输出 %n ms的周期 %n (0~100%)占空比的信号到模拟输出脚 %m.AnalogOutPortName', 'SetPWMPram', 40 , 50 ,'PWM1'],
	    [' ', '输出 %n (0~360)角度到模拟输出脚 %m.AnalogOutPortName (舵机)', 'SetServo', 180 ,'PWM1'],
	    ['R', 'APPID %s 城市%s %m.WeatherDataType 值 ', 'getWeather', '960f7f58abbc5c98030d1899739c1ba8','Beijing', '温度'],
	    ['R', '获取乐为物联APPID %s 设备名称 %s  %m.SensorType 名称 %s 的值','GetLewei', 'da34db80af9c46669159fe8982bbdbe0' ,'ban1' ,'传感器', '湿度'],
	    [' ', '设置乐为物联APPID %s 设备名称 %s  %m.SensorType 名称 %s 的值为 %n ','SetLewei', 'da34db80af9c46669159fe8982bbdbe0' ,'ban1' ,'传感器', '湿度','10']
        ],
        menus: {
            DigitalIOName:['D1','D2','D3','D4','D5','D6'],
  	    DigitalIOmode:['输入','输出'],
  	    DigitalIOOutType:['低','高'],
  	    AnalogInPortName:['A1','A2','A3'],
  	    AnalogOutPortName:['PWM1','PWM2'],
	    WeatherDataType:['温度', '湿度', '风速','大气压','经度','纬度'],
	    SensorType:['传感器', '控制器']
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('Scratch Mini Board', descriptor, ext, {type: 'serial'});
})({});
