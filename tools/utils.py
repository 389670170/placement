#!/usr/bin/python
# -*- coding: UTF-8 -*-

#拷贝文件接口

import os
import shutil
import platform
import json

import color_print

def get_use_platform():
	return platform.system()

def logger(s):
	sysstr = get_use_platform()
	if(sysstr == "Windows"):
		s = s.decode('utf-8').encode('gbk')
	print s

def logger_info(s):
	sysstr = get_use_platform()
	if(sysstr == "Windows"):
		s = s.decode('utf-8').encode('gbk')
	color_print.printGreen(s)

def logger_warn(s):
	sysstr = get_use_platform()
	if(sysstr == "Windows"):
		s = s.decode('utf-8').encode('gbk')
	color_print.printYellow(s)

def logger_err(s):
	sysstr = get_use_platform()
	if(sysstr == "Windows"):
		s = s.decode('utf-8').encode('gbk')
	color_print.printRed(s)

def get_json_file_data(path):
	f = open(path, 'r')
	jsonStr = f.read()
	f.close()
	return json.loads(jsonStr, encoding = 'utf-8')

def format_path(path):
	return path.replace('\\', '/')

def cover_copy_files(src, dst, filtterList):
	if os.path.exists(src):
		if(filtterList is not None):
			bFilter = False
			for filtterFile in filtterList:
				if(filtterFile == src):
					bFilter = True
					break
			if bFilter:
				return
		#目标目录不存在，就创建
		if os.path.isdir(src):
			if not os.path.isdir(dst):
				os.mkdir(dst)
			#拷贝源目录下的所有文件
			files = os.listdir(src)
			for file in files:
				src_path = format_path(os.path.join(src, file))
				dst_path = os.path.join(dst, file)
				cover_copy_files(src_path, dst_path, filtterList)
		elif os.path.isfile(src):
			shutil.copy(src, dst)
		else:
			logger_err("源目录既不是文件夹也不是文件!")
	else:
		logger_err("源目录不存在：")
		logger_err(src.encode('utf-8'))

