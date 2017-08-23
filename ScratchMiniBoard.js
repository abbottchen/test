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
	

/******************************************************/
var EnvicloudCitycodeCached = {};
function fetchEnvicloudCitycode(city,callback){
	if (city in EnvicloudCitycodeCached){
		console.log('缓存的城市代码:'+EnvicloudCitycodeCached[city]);
		callback(EnvicloudCitycodeCached[city]);
		return;
	}
	
	var	Envicloudurl='http://service.envicloud.cn:8082/v2/citycode/YWJIB3R0MTUWMDUYNTQ2MZEZNA=='+'/'+city
	$.ajax({ 
    	url: Envicloudurl,
      	timeout:5000,
     	type: 'GET',
     	dataType: 'json',
      	success: function(data) { 
      		console.log('获取城市代码:'+data.citycode);
      		EnvicloudCitycodeCached[city]=data.citycode;
      		callback(data.citycode)
      	},
      	error: function(XMLHttpRequest, textStatus){
			console.log('Error:'+textStatus);
		},
  	});	
}	
/*
 以下为获取天气相关函数
 */
var EnvicloudWeatherCached = {};
function fetchEnvicloudWeather(city,callback){
	if (city in EnvicloudWeatherCached && Date.now() - EnvicloudWeatherCached[city].time < 3000000) {
		console.log('取缓冲的气候数据:'+EnvicloudWeatherCached[city].data); 
      		callback(EnvicloudWeatherCached[city].data);
		return;
    	}
	
	fetchEnvicloudCitycode(city,function(citycode){
		var	url='http://service.envicloud.cn:8082/v2/weatherlive/YWJIB3R0MTUWMDUYNTQ2MZEZNA==/'+citycode;
		$.ajax({ 
    		url: url,
      		timeout:5000,
     		type: 'GET',
     		dataType: 'json',
      		success: function(weatherData) { 
			console.log('获取气候数据:'+weatherData); 
      			EnvicloudWeatherCached[city] = {data: weatherData, time: Date.now()};
      			callback(weatherData);
      		},
      		error: function(XMLHttpRequest, textStatus){
				console.log('Error:'+textStatus);
			},
  		});
	});
}


function getEnvicloudWeatherDataFromJSOP(type,weatherData){
	var val = null;
    switch (type) {
      	case '温度'://气温(℃) 
       	 	val = weatherData.temperature;
        	break;
        case '体感温度'://体感温度(℃) 
       	 	val = weatherData.feelst;
        	break;
      	case '湿度'://相对湿度(%) 
        	val = weatherData.humidity;
        	break;
      	case '风速'://风速(m/s
        	val = weatherData.windspeed;
        	break;
		case '大气压'://气压(hPa) 
        	val = weatherData.airpressure;	
        	break;
        case '降雨量'://降雨量(mm)
        	val = weatherData.rain;				
        	break;
   	} 
    return val;
}	

ext.GetEnvicloudWeather=function(city,type,callback){
	fetchEnvicloudWeather(city,function(data) {
		var ret=getEnvicloudWeatherDataFromJSOP(type,data);
		console.log('返回值：'+ret); 
		callback(ret);
	});
};
	
/*
 以下为获取空气质量相关函数
 */
var EnvicloudAirCached = {};
function fetchEnvicloudAir(city,callback){
	if (city in EnvicloudAirCached &&Date.now() - EnvicloudAirCached[city].time < 3000000) {
      		//Weather data is cached
		console.log('取缓冲区:'+EnvicloudAirCached[city].data); 
      		callback(EnvicloudAirCached[city].data);
		return;
    	}
	fetchEnvicloudCitycode(city,function(citycode){
		var	url='http://service.envicloud.cn:8082/v2/cityairlive/YWJIB3R0MTUWMDUYNTQ2MZEZNA==/'+citycode;
		$.ajax({ 
    		url: url,
      		timeout:5000,
     		type: 'GET',
     		dataType: 'json',
      		success: function(airData) { 
      			EnvicloudAirCached[city] = {data: airData, time: Date.now()};
      			callback(airData);
      		},
      		error: function(XMLHttpRequest, textStatus){
				console.log('Error:'+textStatus);
			},
  		});
	});
}

function getEnvicloudAirDataFromJSOP(type,airData){
	var val = null;
    switch (type) {
    	case '空气质量指数'://空气质量指数
    		val = airData.AQI;
    		break;
      	case 'PM2.5'://PM2.5浓度(μg/m3)
       	 	val = airData.PM25;			
        	break;
      	case 'PM10'://PM10浓度(μg/m3)					
        	val = airData.PM10;
        	break;
        case '一氧化碳浓度'://一氧化碳浓度(mg/m3)					
        	val = airData.CO;
        	break;	
      	case '二氧化硫浓度'://二氧化硫浓度(μg/m3)
        	val = airData.SO2;	
        	break;
        case '二氧化氮浓度'://二氧化氮浓度(μg/m3)
        	val = airData.NO2;	
        	break;	
	case '臭氧浓度'://臭氧浓度(μg/m3)
        	val = airData.o3;
        	break;		
   	}
    return val;
}	

ext.GetEnvicloudAir=function(city,type,callback){
	fetchEnvicloudAir(city,function(data) {
		var ret=getEnvicloudAirDataFromJSOP(type,data);
		console.log('返回值：'+ret); 
		callback(ret);
	});
};
/******************************************************/	
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
    var descriptor = {
        blocks: [
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'SetDigitPortMode', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'SetDigitPortLevel', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚采样值', 'sensor', 'A1'],
            [' ', '输出 %n ms的周期 %n (0~100%)占空比的信号到模拟输出脚 %m.AnalogOutPortName', 'SetPWMPram', 40 , 50 ,'PWM1'],
	    [' ', '输出 %n (0~360)角度到模拟输出脚 %m.AnalogOutPortName (舵机)', 'SetServo', 90 ,'PWM1'],
	    ['R', '城市:%s 的 %m.WeatherDataType 值 ', 'GetEnvicloudWeather', '北京', '温度'],
	    ['R', '城市:%s 的 %m.AirDataType 值 ', 'GetEnvicloudAir', '北京', 'PM2.5'],	
	    ['R', '获取乐为物联设备标识为 %s  传感器标识为 %s 的值','GetLewei','01' , 'Humidity'],
	    [' ', '设置乐为物联设备标识为 %s  传感器标识为 %s 的值为 %n ','SetLewei' ,'01' ,'Humidity','44'],
            ['R', '获取Yeelink设备为 %s  传感器为 %s 的值','GetYeelink','12094' ,'403236'],
	    [' ', '设置Yeelink设备为 %s  传感器为 %s 的值为 %n','SetYeelink','12094' ,'403236','0']
	],
        menus: {
            DigitalIOName:['D1','D2','D3','D4','D5','D6'],
  	    DigitalIOmode:['输入','输出'],
  	    DigitalIOOutType:['低','高'],
  	    AnalogInPortName:['A1','A2','A3'],
  	    AnalogOutPortName:['PWM1','PWM2'],
	    WeatherDataType:['温度', '体感温度','湿度', '风速','大气压','降雨量'],
	    AirDataType:['空气质量指数', 'PM2.5','PM10', '一氧化碳浓度','二氧化硫浓度','二氧化氮浓度','臭氧浓度'],
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('Scratch Mini Board', descriptor, ext, {type: 'serial'});
})({});
