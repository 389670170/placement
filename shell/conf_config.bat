@echo off
set BAT_PATH=%~dp0

set DOC_PATH=D:\work_space\doc
set DEC_CONF_PATH=%DOC_PATH%\config_base_new
set SERVER_PATH=D:\work_space\ms_server

echo  
echo "svn update %DOC_PATH% and copy to %SERVER_PATH%"