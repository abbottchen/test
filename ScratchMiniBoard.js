// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=9;
    var device = null;

    var	FrameStep=0;
    var FrameBuf= new Uint8Array(300);
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
        'D1': '输入',
        'D2': '输入',
        'D3': '输入',
        'D4': '输入',
        'D5': '输入',
        'D6': '输入'
   };
  var VarDigitIoPortLevel = {
        'D1': '低',
        'D2': '低',
        'D3': '低',
        'D4': '低',
        'D5': '低',
        'D6': '低'
   };
	
   var VarAnalogOutPortPeriod = {
        'PWM1': 0,
        'PWM2': 0
   };
	
   var VarAnalogOutPortWidth = {
        'PWM1': 0,
        'PWM2': 0
   };
/*
typedef struct STRUCT_SCRATCH_CONTROL_BOARD_IN		//
{	
	uint8	Head;
	uint8	Len:4;
	uint8	Ver:3;
	uint8	Direction:1;
        uint8   D0MODE:1;
        uint8   D1MODE:1;       //0 输入  1输出
        uint8   D2MODE:1;       //
        uint8   D3MODE:1;
        uint8   D4MODE:1;
        uint8   D5MODE:1;
        uint8	Reserve1:2;
        
        uint8   D0LEVEL:1;
        uint8   D1LEVEL:1;       //0低  1高
        uint8   D2LEVEL:1;       //
        uint8   D3LEVEL:1;
        uint8   D4LEVEL:1;
        uint8   D5LEVEL:1;
        uint8	Reserve2:2;       
        
        
        uint16  PWM1_PERIOD;
        uint16  PWM1_WIDTH;
        uint16  PWM2_PERIOD;
        uint16  PWM2_WIDTH;
	uint8	CS;
	uint8	End;
}STRUCT_SCRATCH_CONTROL_BOARD_IN;
*/

   function SendFrameToUart()
   {
	var txbuf = new Uint8Array(14);	
	txbuf[0]=0xaa;
	txbuf[1]=0x0a|0x10;   
	txbuf[2]=0;		//mode
	txbuf[3]=0;		//level		
	txbuf[4]=0;		//pwm1
	txbuf[5]=0;
	txbuf[6]=0;
	txbuf[7]=0;
	txbuf[8]=0;		//pwm2
	txbuf[9]=0;
	txbuf[10]=0;   
	txbuf[11]=0;
	   
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
	}
	var output = new Uint8Array([0xaa, 2, 3,4,5,6,7,8,9,10,11,12,13,14]);
    	device.send(output.buffer);
	device.send(txbuf.buffer);	
    }
	
    //设置工作模式
    function SetDigitIoPortMode(which,mode) {
        VarDigitIoPortMode[which]=mode; 
	SendFrameToUart();    
    }
    ext.SetDigitPortMode = function(which,mode) { return SetDigitIoPortMode(which,mode); };
	
   function SetDigitIoPortLevel(which,level) {
        VarDigitIoPortLevel[which]=level; 
	SendFrameToUart();   
    }
   ext.SetDigitPortLevel = function(level,which) { return SetDigitIoPortLevel(which,level); };	

    function getSensor(which) {
        return inputs[which];
    }
	
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

    ext.sensor = function(which) { return getSensor(which); };	
		
    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'ScratchMiniBoard disconnected'};
        if(watchdog) return {status: 1, msg: 'Probing for ScratchMiniBoard'};
        return {status: 2, msg: 'ScratchMiniBoard connected'};
    }

    var descriptor = {
        blocks: [
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'SetDigitPortMode', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'SetDigitPortLevel', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚 值', 'sensor', 'A1'],
            [' ', '输出 %n ms的周期,%n (0~100%)占空比的信号到模拟输出脚 %m.AnalogIOName', 'sensor', 7,0,'PWM1']
        ],
        menus: {
            DigitalIOName:['D1','D2','D3','D4','D5','D6'],
  	    DigitalIOmode:['输入','输出'],
  	    DigitalIOOutType:['低','高'],
  	    AnalogInPortName:['A1','A2','A3'],
  	    AnalogOutPortName:['PWM1','PWM2']
        },
        url: 'https://abbottchen.github.io/test/ScratchMiniBoard.js'
    };
    ScratchExtensions.register('Scratch Mini Board', descriptor, ext, {type: 'serial'});
})({});
