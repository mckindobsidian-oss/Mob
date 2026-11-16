.intel_syntax noprefix
.global mob_start
.section .text
mob_start:
    sub rsp, 56
    lea r8, [rip + edge]
    lea r9, [rip + app]
    call open
    cmp rax, 32
    ja done
    lea r8, [rip + chrome]
    lea r9, [rip + app]
    call open
    cmp rax, 32
    ja done
    lea r8, [rip + url]
    xor r9d, r9d
    call open
    cmp rax, 32
    ja done
    xor ecx, ecx
    lea rdx, [rip + error_text]
    lea r8, [rip + title]
    mov r9d, 0x40
    call QWORD PTR [rip + MessageBoxW]
done:
    xor ecx, ecx
    call QWORD PTR [rip + ExitProcess]
    int3
open:
    xor ecx, ecx
    lea rdx, [rip + verb]
    mov QWORD PTR [rsp + 40], 0
    mov QWORD PTR [rsp + 48], 1
    jmp QWORD PTR [rip + ShellExecuteW]

# Windows ShellExecuteW accepts a UTF-16 verb, program and arguments.
.macro wide label, text
\label:
    .irp c,\text
      .short '\c
    .endr
    .short 0
.endm
.include "strings.inc"

.section .idata,"aw"
# Import directory, followed by the writable import address table and names.
.long 0, 0, 0, shell32, ShellExecuteW
.long 0, 0, 0, kernel32, ExitProcess
.long 0, 0, 0, user32, MessageBoxW
.long 0, 0, 0, 0, 0
ShellExecuteW: .quad shell_execute_name, 0
ExitProcess: .quad exit_name, 0
MessageBoxW: .quad message_name, 0
shell32: .asciz "SHELL32.dll"
kernel32: .asciz "KERNEL32.dll"
user32: .asciz "USER32.dll"
.balign 2
shell_execute_name: .short 0; .asciz "ShellExecuteW"
.balign 2
exit_name: .short 0; .asciz "ExitProcess"
.balign 2
message_name: .short 0; .asciz "MessageBoxW"
