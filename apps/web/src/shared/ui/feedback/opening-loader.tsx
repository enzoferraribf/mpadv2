export function OpeningLoader(input: { label: string }) {
    return (
        <div className='route-loader'>
            <span className='mpad-logo'>Opening {input.label}</span>
            <div className='route-loader-bar'>
                <span />
            </div>
        </div>
    )
}
