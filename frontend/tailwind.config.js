/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
	darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#202225',
          800: '#2f3136',
          700: '#36393f',
          600: '#4f545c',
          400: '#d4d7dc',
          300: '#e3e5e8',
          200: '#ebedef',
          100: '#f2f3f5',
        },
      },
      spacing: {
        88: '22rem',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 1.5s infinite',
        'bounce-fast': 'bounce 1s infinite',

        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // 'pulse-custom': 'pulse 3s cubic-bezier(0.4, 0, 0.1, 1) infinite',
        'pulse-custom': 'pulse 3s ease-in-out infinite',
        
        'ping-slow': 'ping 3s cubic-bezier(1, 2, 0.5, 3) infinite',
        'ping-fast': 'ping 0.1s cubic-bezier(1, 2, 0.5, 3) infinite',

        // 'gradient-x':'gradient-x 15s ease infinite',
        // 'gradient-y':'gradient-y 15s ease infinite',
        // 'gradient-xy':'gradient-xy 15s ease infinite',
        'gradient-x':'gradient-x 6s ease-in-out infinite',
        'gradient-y':'gradient-y 5s ease infinite',
        'gradient-xy':'gradient-xy 5s ease infinite',
        'gradient-custom':'gradient-custom 2s linear infinite',
        // 'gradient-move':'gradient-move 5s cubic-bezier(0, 1, 1.0, 1.0) infinite',
        'gradient-move':'gradient-move 5s linear infinite',

      },
      keyframes: {
        'gradient-move': {
          '0%': { 
            'background-size':'300% 100%',
            'background-position': '100% 0%'
          },
          '100%' : { 
            'background-size':'300% 100%',
            'background-position' : '0% 0%' 
          },
        },

        'gradient-custom': {
          '0%': {
            'background-size':'400% 400%',
            'background-position': '20% 0%',
          },
          '20%': {
            'background-size':'400% 400%',
            'background-position': '40% 40%',
          },
          '40%': {
            'background-size':'400% 400%',
            'background-position': '60% 60%',
          },
          '60%': {
            'background-size':'400% 400%',
            'background-position': '80% 80%',
          },
          '80%': {
            'background-size':'400% 400%',
            'background-position': '100% 80%',
          },
          // '100%': {
          //   'background-size':'400% 400%',
          //   'background-position': '100% 0%',
          // },
        },
        'gradient-y': {
            '0%, 100%': {
                'background-size':'400% 400%',
                'background-position': 'center top'
            },
            '50%': {
                'background-size':'200% 200%',
                'background-position': 'center center'
            }
        },
        'gradient-x': {
            '0%, 100%': {
                'background-size':'200% 200%',
                'background-position': 'left center'
            },
            '50%': {
                'background-size':'200% 200%',
                'background-position': 'right center'
            }
        },
        'gradient-xy': {
            '0%, 100%': {
                'background-size':'400% 400%',
                'background-position': 'left center'
            },
            '50%': {
                'background-size':'200% 200%',
                'background-position': 'right center'
            }
        }
      },
    },
  },
  plugins: [],
}
