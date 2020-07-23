#!/usr/bin/python
# -*- coding: UTF-8 -*-

import ctypes, sys
import platform

systemStr = platform.system()
#---------------------------------------------------------
# window下cmd彩色打印
#---------------------------------------------------------
STD_INPUT_HANDLE = -10
STD_OUTPUT_HANDLE = -11
STD_ERROR_HANDLE = -12

#字体颜色定义 text colors
FOREGROUND_GREEN = 0x0a
FOREGROUND_RED = 0x0c
FOREGROUND_YELLOW = 0x0e
FOREGROUND_DARK_WHITE = 0x07

std_out_handle = ctypes.windll.kernel32.GetStdHandle(STD_OUTPUT_HANDLE)

def set_cmd_text_color_win(color, handle=std_out_handle):
    Bool = ctypes.windll.kernel32.SetConsoleTextAttribute(handle, color)
    return Bool
 
#reset white
def reset_color_win():
    set_cmd_text_color_win(FOREGROUND_DARK_WHITE)
 
#green
def print_green_win(mess):
    set_cmd_text_color_win(FOREGROUND_GREEN)
    sys.stdout.write(mess + '\n')
    reset_color_win()

#red
def print_red_win(mess):
    set_cmd_text_color_win(FOREGROUND_RED)
    sys.stdout.write(mess + '\n')
    reset_color_win()
  
#yellow
def print_yellow_win(mess):
    set_cmd_text_color_win(FOREGROUND_YELLOW)
    sys.stdout.write(mess + '\n')
    reset_color_win()

#---------------------------------------------------------
# 其他平台下cmd彩色打印
#---------------------------------------------------------
COLOR_RED = '\033[1;31;0m'
COLOR_GREEN = '\033[32m'
COLOR_YELLOW = '\033[33m'

COLOR_DEFAULT = '\033[0m'


def printGreen(s):
	if(systemStr == "Windows"):
		print_green_win(s)
	else:
		print COLOR_GREEN + s + COLOR_DEFAULT

def printYellow(s):
	if(systemStr == "Windows"):
		print_yellow_win(s)
	else:
		print COLOR_YELLOW + s + COLOR_DEFAULT

def printRed(s):
	if(systemStr == "Windows"):
		print_red_win(s)
	else:
		print COLOR_RED + s + COLOR_DEFAULT
