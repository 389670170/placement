call conf_config.bat

pushd %DOC_PATH%
svn update

set FLODLER=develop
echo ">>>>> copy from %FLODLER%"
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\activities\*   %SERVER_PATH%\conf\
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\serveronly\*   %SERVER_PATH%\conf\
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\common\*       %SERVER_PATH%\conf\

set FLODLER=develop_korea
echo ">>>>> copy from %FLODLER%"
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\activities\*   %SERVER_PATH%\conf\
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\serveronly\*   %SERVER_PATH%\conf\
xcopy /S /Y /Q %DEC_CONF_PATH%\%FLODLER%\common\*       %SERVER_PATH%\conf\

echo ">>>>> copy language conf"
xcopy /S /Y /Q %SERVER_PATH%\conf\language\korea\* %SERVER_PATH%\conf\

cd %BAT_PATH%