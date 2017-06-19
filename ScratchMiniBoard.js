// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var UART_REV_FRAME_LEN=9;
    var device = null;
    var rawData = null;
    var RevLoopBuf = new Uint8Array(4096);
    var RevLoopInPt=0;
    var RevLoopOutPt=0;
    var ProtocolVer=0;
    var DataLen=0;
    
    var inputs = {
        'D1': 1,
        'D2': 2,
        'D3': 3,
        'D4': 4,
        'D5': 5,
        'D6': 6,
        'A1': 7,
        'A2': 8,
        'A3': 9
    };

    inputs['D1']=2;
	
    function getSensor(which) {
        return inputs[which];
    }
    
    function GetByteFromUart(pt){
	    if(pt>=4096)
		    pt=pt-4096;
	    return (RevLoopBuf[pt]);
    }
    
    function GetFrameFromLoopBuf() {
        var RevDataCount=0;
	inputs['D1']=22;
	inputs['D6']=inputs['D6']+1;    
        while (true)//获取正确的合法帧
	{
			inputs['D1']=25;
			inputs['D4']=RevLoopInPt;
			if(RevLoopInPt>=RevLoopOutPt)
				RevDataCount=RevLoopInPt-RevLoopOutPt;
			else
				RevDataCount=4096-RevLoopOutPt+RevLoopInPt;
			
			inputs['D1']=27; 
			//帧长度不够,继续等待帧长度够时，再处理
			if(RevDataCount<UART_REV_FRAME_LEN)
				return;
			inputs['D2']=20;
			//判断帧头是否正确
			if(GetByteFromUart[RevLoopOutPt]!=0xaa)
			{
				RevLoopOutPt++;
                		if(RevLoopOutPt>=4096)
                    			RevLoopOutPt=0;
				continue;
			}
			inputs['D3']=33;	
			//获取协议版本
			ProtocolVer=GetByteFromUart(RevLoopOutPt+1)&0x30;
			ProtocolVer=ProtocolVer>>4;

			//判断长度是否正确
			DataLen=GetByteFromUart(RevLoopOutPt+1)&0x0f;
			if(DataLen!=(UART_REV_FRAME_LEN-4))
			{
				RevLoopOutPt++;
                		if(RevLoopOutPt>=4096)
                   		 RevLoopOutPt=0;
				continue;
			}
			inputs['D3']=44;
			//判断结束符是否正确
			if(GetByteFromUart(RevLoopOutPt+UART_REV_FRAME_LEN-1)!=0x16)
			{
				RevLoopOutPt++;
                		if(RevLoopOutPt>=4096)
                   		 RevLoopOutPt=0;
				continue;
			}
			inputs['D3']=55;
			//计算校验和
			var Sum=0;
			for(var i=0;i<(UART_REV_FRAME_LEN-2);i++)
			{
				Sum=Sum+GetByteFromUart(RevLoopOutPt+i);
			}
			//判断校验和是否正确
			if(GetByteFromUart(RevLoopOutPt+UART_REV_FRAME_LEN-2)!=Sum)
			{
				RevLoopOutPt++;
                		if(RevLoopOutPt>=4096)
                    		RevLoopOutPt=0;
				continue;
			}
            		inputs['D3']=66;
            		var SensorData=new Uint8Array(9);
			//帧全部正确了！
			for(var i=0;i<UART_REV_FRAME_LEN;i++)
			{
				SensorData[i]=GetByteFromUart(RevLoopOutPt+i);
			}
			//调整Out指针
			RevLoopOutPt=RevLoopOutPt+UART_REV_FRAME_LEN;
			if(RevLoopOutPt>=4096)
				RevLoopOutPt=RevLoopOutPt-4096;
            		inputs['D3']=77;
            		clearTimeout(watchdog); 
            		watchdog = null; 
            		GetSensorFromFrame(SensorData);
		}
    }

    function GetSensorFromFrame(frame) {
        inputs['D3']=99;
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

        device.open({ stopBits: 0, bitRate: 57600, parityBit:2, ctsFlowControl: 0 });
        device.set_receive_handler(function(data) {
	    clearTimeout(watchdog); 
            watchdog = null;
            console.log('Received: ' + data.byteLength);
	    inputs['D1']=11;	
            //放置接收的数据到环形缓冲区
            for(var i=0;i<data.byteLength;i++)
            {
                if(RevLoopInPt>=4096)
                    RevLoopInPt=0;
                RevLoopBuf[RevLoopInPt]=data[i];
		RevLoopInPt++;   
            }
	    inputs['D5']=RevLoopInPt;
            if(data.byteLength >0) {
                GetFrameFromLoopBuf();
            }
        });

        watchdog = setTimeout(function() {
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
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
            [' ', '设置数字 %m.DigitalIOName 脚为 %m.DigitalIOmode', 'sensor', 'D1', '输入'],
            [' ', '输出 %m.DigitalIOOutType 电平到 数字 %m.DigitalIOName 脚', 'sensor', '低', 'D1'],
            ['r', '数字脚 %m.DigitalIOName 脚 输入电平', 'sensor', 'D1'],
            ['r', '模拟输入脚 %m.AnalogInPortName 脚 值', 'sensor', 'A1'],
            [' ', '输出 %n ms(周期),占空比 %n (0~100%) 信号到模拟输出脚 %m.AnalogIOName', 'sensor', 0,0,'PWM1']
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
    ScratchExtensions.register('ScratchMiniBoard', descriptor, ext, {type: 'serial'});
})({});
